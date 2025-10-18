import React, { useState } from 'react';
import axios from 'axios';
import logo from './Qshala_logo.gif';
import './App.css';

// This is the list of options for our dropdown menu
const REIMBURSEMENT_TYPES = [
  'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel', 
  'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
  'Printing and stationery for quiz', 'Train Ticket'
];

function App() {
  // --- State Management ---
  // These variables will hold the data and control the UI
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // --- Function to Handle File Upload and AI Processing ---
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setIsLoading(true);
    setMessage('');
    setExtractedData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Make API call to our FastAPI backend to process the invoice
      const response = await axios.post('http://127.0.0.1:8000/api/process-invoice/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExtractedData(response.data); // Store the AI's response
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Function to Handle Form Data Changes ---
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setExtractedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // --- Function to Handle Final Submission to RazorpayX ---
  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    setIsLoading(true);
    setMessage('');

    try {
      // Make API call to our backend to create the reimbursement
      const response = await axios.post('http://127.0.0.1:8000/api/create-reimbursement/', extractedData);
      setMessage(`Success! ${response.data.message}`);
      setExtractedData(null); // Reset the form
      setSelectedFile(null);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>📄 AI Reimbursement Uploader</h1>
      <img src={logo} alt="Qshala Logo" className="app-logo" />
      {/* --- Step 1: The Upload Box --- */}
      {!extractedData && (
        <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
          <input
            type="file"
            id="fileInput"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
          <p>{selectedFile ? selectedFile.name : 'Click here to upload invoice'}</p>
        </div>
      )}

      {/* --- Loading Spinner --- */}
      {isLoading && <div className="spinner">Processing... 🤖</div>}

      {/* --- Error/Success Messages --- */}
      {message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}

      {/* --- Step 2: The Verification Form (shows after AI processing) --- */}
      {extractedData && !isLoading && (
        <form className="verification-form" onSubmit={handleSubmit}>
          <h2>Please Verify Details</h2>
          <div className="form-group">
            <label htmlFor="type">Type of Reimbursement</label>
            <select id="type" name="type" value={extractedData.type} onChange={handleInputChange}>
              {REIMBURSEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="amount">Amount (INR)</label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={extractedData.amount}
              onChange={handleInputChange}
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={extractedData.description}
              onChange={handleInputChange}
              rows="3"
            />
          </div>
          <button type="submit">Confirm & Submit Reimbursement</button>
        </form>
      )}
    </div>
  );
}

export default App;