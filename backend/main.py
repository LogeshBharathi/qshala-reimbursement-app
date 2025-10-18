# main.py
import os
import json
import requests
import uuid
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# Load environment variables from .env file
load_dotenv()

# --- Configure APIs ---
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_ACCOUNT_NUMBER = os.getenv("RAZORPAY_ACCOUNT_NUMBER")

# --- Initialize FastAPI App ---
app = FastAPI(title="Qshala Reimbursement API")

# --- Mount the static directory to serve images ---
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Add CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Define Reimbursement Types ---
REIMBURSEMENT_TYPES = [
    'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel', 
    'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
    'Printing and stationery for quiz', 'Train Ticket'
]

# --- API Endpoint 1: Process Invoice Image (FIXED) ---
@app.post("/api/process-invoice/")
async def process_invoice(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")
    try:
        # --- Save the uploaded file ---
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Create the directories if they don't exist
        os.makedirs("static/invoices", exist_ok=True)
        file_path = f"static/invoices/{unique_filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_url = f"http://127.0.0.1:8000/{file_path}"
        file.file.seek(0)
        
        # --- Continue with AI processing ---
        img = Image.open(file.file)
        model = genai.GenerativeModel('models/gemini-flash-latest')
        
        # --- PROMPT IS RESTORED HERE ---
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

        # --- Add the file URL to the response ---
        extracted_data['invoice_url'] = file_url
        
        return extracted_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process invoice: {str(e)}")


# --- API Endpoint 2: Create Reimbursement Payout (UPDATED) ---
@app.post("/api/create-reimbursement/")
async def create_reimbursement(data: dict):
    reimbursement_type = data.get("type")
    amount = data.get("amount")
    description = data.get("description")
    invoice_url = data.get("invoice_url") # Get the invoice URL

    amount_in_paise = int(float(amount) * 100)

    try:
        # Step 1: Create a Contact
        contact_data = { "name": "Qshala Test Employee", "type": "employee" }
        contact_res = requests.post(
            'https://api.razorpay.com/v1/contacts',
            json=contact_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
        ).json()
        if 'error' in contact_res and contact_res['error'].get('description'):
            raise Exception(f"Contact creation failed: {contact_res['error']['description']}")
        contact_id = contact_res['id']

        # Step 2: Create a Fund Account
        fund_account_data = {
            "contact_id": contact_id,
            "account_type": "bank_account",
            "bank_account": {
                "name": "Test Account Holder", "ifsc": "UTIB0000000", "account_number": "2323231234567890"
            }
        }
        fund_account_res = requests.post(
            'https://api.razorpay.com/v1/fund_accounts',
            json=fund_account_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
        ).json()
        if 'error' in fund_account_res and fund_account_res['error'].get('description'):
            raise Exception(f"Fund account creation failed: {fund_account_res['error']['description']}")
        fund_account_id = fund_account_res['id']

        # Step 3: Create the Payout
        payout_data = {
            "account_number": RAZORPAY_ACCOUNT_NUMBER, "fund_account_id": fund_account_id,
            "amount": amount_in_paise, "currency": "INR", "mode": "IMPS", "purpose": "payout",
            "queue_if_low_balance": True,
            "notes": {
                "reimbursement_type": reimbursement_type, "description": description, "invoice_url": invoice_url
            }
        }
        payout_res = requests.post(
            'https://api.razorpay.com/v1/payouts',
            json=payout_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
        ).json()
        
        if 'error' in payout_res and payout_res['error'].get('description') is not None:
            raise Exception(f"Payout creation failed: {payout_res['error']['description']}")
        
        return {"status": "success", "message": "Reimbursement created and queued for approval.", "details": payout_res}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Diagnostic Endpoint to List Available Models ---
@app.get("/api/list-models/")
def list_models():
    #... (This function remains the same)
    try:
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        return {"models_you_can_use": available_models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Welcome Endpoint ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Qshala Reimbursement API"}