# 🚀 Qshala AI Reimbursement App

A full-stack web application that automates the expense reimbursement process. This project uses AI to extract data from uploaded invoice images and creates a payout directly in RazorpayX, complete with a permanent link to the invoice stored on the cloud.

### ✨ Live Demo

* **Frontend (Vercel):** [https://qshala-reimbursement-app.vercel.app/](https://qshala-reimbursement-app.vercel.app/)
* **Backend (Render):** [https://qshala-reimbursement-api.onrender.com/](https://qshala-reimbursement-api.onrender.com/)

---

### 🎥 GIF

![Project Demo GIF](https://qshala-reimbursement-app.vercel.app/static/media/Qshala_logo.b825c0f2fd3ca3b7ca1e.gif) 

---

### ## Key Features

* **AI-Powered Data Extraction:** Uses the Google Gemini AI to read invoice images and automatically extract the reimbursement type, amount, and description.
* **Cloud Image Storage:** Invoices are uploaded to Cloudinary for permanent, scalable storage.
* **Real-time Payout Creation:** Integrates with the RazorpayX API to create payouts in real-time, which appear instantly on the dashboard.
* **Modern UI/UX:** A sleek, responsive user interface built with React, featuring a modal-based verification flow and toast notifications, all styled with the Qshala brand theme.
* **Robust Backend:** A resilient FastAPI server with data validation and error handling.
* **Fully Deployed:** The entire application is deployed with a CI/CD pipeline using Render for the backend and Vercel for the frontend.

---

### ## 🛠️ Tech Stack

| Frontend | Backend |
| :--- | :--- |
| React.js | Python 3 |
| Axios | FastAPI |
| CSS3 | Uvicorn |
| | Google Gemini AI |
| | Cloudinary API |
| | RazorpayX API |

---

### ## Local Setup and Installation

**Prerequisites:**
* Python 3.10+
* Node.js and npm
* Git

#### **1. Backend Setup**
```bash
# Navigate to the backend folder
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\Venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create a .env file and add your secret keys (see .env.example)

# Run the server
uvicorn main:app --reload
````

#### **2. Frontend Setup**

```bash
# Navigate to the frontend folder
cd frontend

# Install dependencies
npm install

# Run the development server
npm start
```

-----

### \#\# 🔑 Environment Variables

You will need to create a `.env` file in the `backend` directory with the following keys:

```
GOOGLE_API_KEY="..."
RAZORPAY_KEY_ID="..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_ACCOUNT_NUMBER="..."
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

-----

### \#\# 🔮 Future Improvements

  * **Manager Approval Dashboard:** A separate interface for managers to approve or reject queued payouts.
  * **Batch Uploads:** Allow users to upload multiple invoices at once.
  * **Analytics:** A dashboard to track spending by category and employee.

<!-- end list -->

```
```
