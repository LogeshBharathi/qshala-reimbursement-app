// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logo from './Qshala_logo.gif';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const REIMBURSEMENT_TYPES = [
  'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel', 
  'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
  'Printing and stationery for quiz', 'Train Ticket'
];

function App() {
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // NEW: State to hold a message specifically for the modal
  const [modalMessage, setModalMessage] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setMessage('');
    setExtractedData(null);
    setModalMessage(''); // Reset modal message
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/process-invoice/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // ✅ THIS IS THE FIX: Check if the AI failed to extract data
      if (!response.data.amount || response.data.amount === 0) {
        setModalMessage("AI couldn't read the details. Please fill them in manually.");
      }
      
      setExtractedData(response.data);
      setIsModalOpen(true);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred. Check backend logs.';
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setExtractedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!extractedData.amount || parseFloat(extractedData.amount) <= 0) {
        setModalMessage('Error: Amount is missing or invalid. Please enter a valid amount.');
        return;
    }
    
    setIsLoading(true);
    setModalMessage('');

    try {
      const response = await axios.post(`${API_URL}/api/create-reimbursement/`, extractedData);
      setMessage(`Success! ${response.data.message}`);
      closeModal();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
      setModalMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setExtractedData(null);
    setImagePreview('');
    setMessage('');
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  return (
    <div className="container">
      <img src={logo} alt="Qshala Logo" className="app-logo" />
      <h1>🚀 Qshala AI Reimbursements</h1>
      <p>Upload your invoice to begin the reimbursement process.</p>
      
      <button 
        onClick={() => document.getElementById('fileInput').click()} 
        disabled={isLoading}
      >
        {isLoading ? 'Processing... 🤖' : 'Click to Upload Invoice'}
      </button>
      
      <input type="file" id="fileInput" className="hidden" onChange={handleFileChange} accept="image/*" />

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="close-button" onClick={closeModal}>&times;</span>
            <form className="verification-form" onSubmit={handleSubmit}>
              <h2>Please Verify Details</h2>
              
              {/* NEW: Display the modal-specific message here */}
              {modalMessage && <div className={`message ${modalMessage.startsWith('Error') ? 'error' : 'success'}`}>{modalMessage}</div>}

              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Invoice Preview" className="invoice-preview-image"/>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="type">Type of Reimbursement</label>
                <select id="type" name="type" value={extractedData.type || 'Other'} onChange={handleInputChange}>
                  {REIMBURSEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="amount">Amount (INR)</label>
                <input
                  type="number" id="amount" name="amount"
                  value={extractedData.amount || ''} onChange={handleInputChange}
                  step="0.01" placeholder="e.g., 770.00" required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description" name="description"
                  value={extractedData.description || ''} onChange={handleInputChange}
                  rows="3" placeholder="e.g., Invoice from Global Horizons"
                />
              </div>
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Confirm & Submit Reimbursement'}
              </button>
            </form>
          </div>
        </div>
      )}

      {!isModalOpen && message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}
    </div>
  );
}

export default App;