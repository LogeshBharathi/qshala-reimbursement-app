# main.py
import os
import json
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# New Google Drive Imports
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import io

# Load environment variables from .env file
load_dotenv()

# --- Configure APIs ---
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_ACCOUNT_NUMBER = os.getenv("RAZORPAY_ACCOUNT_NUMBER")

# New Google Drive Config
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/drive']

# --- Initialize FastAPI App ---
app = FastAPI(title="Qshala Reimbursement API")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://qshala-reimbursement-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reimbursement Types list
REIMBURSEMENT_TYPES = [
    'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel',
    'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
    'Printing and stationery for quiz', 'Train Ticket'
]


# --- Helper function to upload to Google Drive (FIXED) ---
def upload_to_drive(file_stream, filename, mimetype):
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if creds_json:
        creds_info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    
    service = build('drive', 'v3', credentials=creds)
    
    file_metadata = {'name': filename, 'parents': [GOOGLE_DRIVE_FOLDER_ID]}
    
    # We need to read the file into memory to upload it
    file_stream.seek(0)
    media_body = MediaIoBaseUpload(io.BytesIO(file_stream.read()), mimetype=mimetype, resumable=True)

    file = service.files().create(
        body=file_metadata,
        media_body=media_body,
        fields='id, webViewLink'
    ).execute()
    
    # Make the file publicly accessible
    file_id = file.get('id')
    service.permissions().create(fileId=file_id, body={'role': 'reader', 'type': 'anyone'}).execute()
    
    return file.get('webViewLink')


# --- API Endpoint 1: Process Invoice Image (UPGRADED) ---
@app.post("/api/process-invoice/")
async def process_invoice(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")
    try:
        # --- UPGRADED: Upload the file to Google Drive with dynamic mimetype ---
        invoice_url = upload_to_drive(file.file, file.filename, file.content_type)
        
        # Rewind the file to be read by PIL for AI processing
        file.file.seek(0)
        
        # --- Continue with AI processing ---
        img = Image.open(file.file)
        model = genai.GenerativeModel('models/gemini-flash-latest')
        
        prompt = f"""
        Analyze the invoice image and extract the key details.
        From the list of reimbursement types provided, select the most appropriate one.
        The amount should be a number (float or integer), without currency symbols or commas.
        The description should be a short, concise summary of the invoice.
        Return ONLY a single, clean JSON object with the keys "type", "amount", and "description".
        Reimbursement Types: {', '.join(REIMBURSEMENT_TYPES)}
        """
        response = model.generate_content([prompt, img])

        json_text = response.text.strip().replace("```json", "").replace("```", "")
        extracted_data = json.loads(json_text)

        # --- Add the NEW Google Drive URL to the response ---
        extracted_data['invoice_url'] = invoice_url
        
        return extracted_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process invoice: {str(e)}")


# --- API Endpoint 2: Create Reimbursement Payout ---
@app.post("/api/create-reimbursement/")
async def create_reimbursement(data: dict):
    reimbursement_type = data.get("type")
    amount = data.get("amount")
    description = data.get("description")
    invoice_url = data.get("invoice_url")
    amount_in_paise = int(float(amount) * 100)
    try:
        contact_data = { "name": "Qshala Test Employee", "type": "employee" }
        contact_res = requests.post('https://api.razorpay.com/v1/contacts', json=contact_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in contact_res and contact_res['error'].get('description'):
            raise Exception(f"Contact creation failed: {contact_res['error']['description']}")
        contact_id = contact_res['id']

        fund_account_data = {"contact_id": contact_id, "account_type": "bank_account", "bank_account": {"name": "Test Account Holder", "ifsc": "UTIB0000000", "account_number": "2323231234567890"}}
        fund_account_res = requests.post('https://api.razorpay.com/v1/fund_accounts', json=fund_account_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in fund_account_res and fund_account_res['error'].get('description'):
            raise Exception(f"Fund account creation failed: {fund_account_res['error']['description']}")
        fund_account_id = fund_account_res['id']

        payout_data = {"account_number": RAZORPAY_ACCOUNT_NUMBER, "fund_account_id": fund_account_id, "amount": amount_in_paise, "currency": "INR", "mode": "IMPS", "purpose": "payout", "queue_if_low_balance": True, "notes": { "reimbursement_type": reimbursement_type, "description": description, "invoice_url": invoice_url }}
        payout_res = requests.post('https://api.razorpay.com/v1/payouts', json=payout_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in payout_res and payout_res['error'].get('description') is not None:
            raise Exception(f"Payout creation failed: {payout_res['error']['description']}")
        
        return {"status": "success", "message": "Reimbursement created and queued for approval.", "details": payout_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Other Endpoints ---
@app.get("/api/list-models/")
def list_models():
    try:
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        return {"models_you_can_use": available_models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Welcome to the Qshala Reimbursement API"}