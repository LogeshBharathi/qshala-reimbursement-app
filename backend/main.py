# main.py
import os
import json
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image
import cloudinary
import cloudinary.uploader

# Load environment variables
load_dotenv()

# --- Configure APIs ---
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_ACCOUNT_NUMBER = os.getenv("RAZORPAY_ACCOUNT_NUMBER")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

# --- Initialize FastAPI App & CORS ---
app = FastAPI(title="Qshala Reimbursement API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://qshala-reimbursement-app.vercel.app"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

REIMBURSEMENT_TYPES = [
    'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel',
    'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
    'Printing and stationery for quiz', 'Train Ticket'
]

# backend/main.py

# --- API Endpoint 1: Process Invoice Image (UPGRADED with better prompt) ---
@app.post("/api/process-invoice/")
async def process_invoice(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")
    try:
        upload_result = cloudinary.uploader.upload(file.file, folder="qshala_invoices")
        invoice_url = upload_result.get("secure_url")
        file.file.seek(0)
        img = Image.open(file.file)
        model = genai.GenerativeModel('models/gemini-flash-latest')
        
        # --- THIS IS THE NEW, SMARTER PROMPT ---
        prompt = f"""
        You are an expert invoice data extractor. Analyze the invoice image and perform the following tasks:
        1.  **Extract the final total amount.** Look for keywords like 'Total', 'Grand Total', or 'Amount Due'. This is the most important value. The amount should be a number (float or integer) without any currency symbols or commas.
        2.  **Determine the category.** Based on the vendor name and line items (e.g., 'Travel Solutions', 'Car Rental'), choose the most appropriate category from this list: {', '.join(REIMBURSEMENT_TYPES)}.
        3.  **Create a concise description.** Summarize the expense, including the vendor name if possible (e.g., "Invoice from Global Horizons Travel Solutions").
        
        Return ONLY a single, clean JSON object with the keys "type", "amount", and "description".
        If you cannot find a clear total amount, return a null or 0 for the amount.
        """
        
        response = model.generate_content([prompt, img])

        if not response.parts:
            raise HTTPException(status_code=500, detail="AI response was blocked. Try a different invoice.")
        
        json_text = response.parts[0].text
        json_text = json_text.strip().replace("```json", "").replace("```", "")
        extracted_data = json.loads(json_text)
        extracted_data['invoice_url'] = invoice_url
        return extracted_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process invoice: {str(e)}")

# --- API Endpoint 2: Create Reimbursement Payout ---
@app.post("/api/create-reimbursement/")
async def create_reimbursement(data: dict):
    amount = data.get("amount")
    if not amount or float(amount) <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount provided. Amount cannot be zero or empty.")

    invoice_url = data.get("invoice_url")
    description = data.get("description")
    reimbursement_type = data.get("type")
    amount_in_paise = int(float(amount) * 100)
    
    try:
        contact_data = {"name": "Qshala Test Employee", "type": "employee"}
        contact_res = requests.post('https://api.razorpay.com/v1/contacts', json=contact_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in contact_res and contact_res['error'].get('description'):
            raise Exception(f"Contact creation failed: {contact_res['error']['description']}")
        contact_id = contact_res['id']

        fund_account_data = {"contact_id": contact_id, "account_type": "bank_account", "bank_account": {"name": "Test Account Holder", "ifsc": "UTIB0000000", "account_number": "2323231234567890"}}
        fund_account_res = requests.post('https://api.razorpay.com/v1/fund_accounts', json=fund_account_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in fund_account_res and fund_account_res['error'].get('description'):
            raise Exception(f"Fund account creation failed: {fund_account_res['error']['description']}")
        fund_account_id = fund_account_res['id']

        payout_data = {"account_number": RAZORPAY_ACCOUNT_NUMBER, "fund_account_id": fund_account_id, "amount": amount_in_paise, "currency": "INR", "mode": "IMPS", "purpose": "payout", "queue_if_low_balance": True, "notes": {"reimbursement_type": reimbursement_type, "description": description, "invoice_url": invoice_url}}
        payout_res = requests.post('https://api.razorpay.com/v1/payouts', json=payout_data, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)).json()
        if 'error' in payout_res and payout_res['error'].get('description') is not None:
            raise Exception(f"Payout creation failed: {payout_res['error']['description']}")
        
        return {"status": "success", "message": "Reimbursement created and queued for approval.", "details": payout_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Other Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Qshala Reimbursement API"}