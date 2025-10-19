// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logo from './Qshala_logo.gif';

const API_URL = process.env.REACT_APP_API_URL || 'https://qshala-reimbursement-api.onrender.com';

const REIMBURSEMENT_TYPES = [
  'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel', 
  'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
  'Printing and stationery for quiz', 'Train Ticket'
];

function App() {
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('form');

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('Uploading invoice...');
    setMessage('');
    setSubmissionStatus('form');
    setModalMessage('');
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const axiosConfig = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 };
      setLoadingMessage('AI is reading the invoice...');
      const response = await axios.post(`${API_URL}/api/process-invoice/`, formData, axiosConfig);
      
      if (!response.data.amount || response.data.amount === 0) {
        setModalMessage("AI couldn't read the details. Please fill them in manually.");
      }
      setExtractedData(response.data);
      setIsModalOpen(true);
    } catch (error) {
      const errorMsg = error.code === 'ECONNABORTED' 
        ? 'The server took too long to respond. Please try again.' 
        : (error.response?.data?.detail || 'An unexpected error occurred.');
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setExtractedData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!extractedData.amount || parseFloat(extractedData.amount) <= 0) {
      setModalMessage('Error: Amount is missing or invalid.');
      return;
    }
    
    setSubmissionStatus('loading');
    setModalMessage('');

    try {
      await axios.post(`${API_URL}/api/create-reimbursement/`, extractedData);
      setSubmissionStatus('success');

      setTimeout(() => {
        closeModal();
        setMessage('Successfully submitted reimbursement!');
      }, 2000);

    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
      setModalMessage(`Error: ${errorMsg}`);
      setSubmissionStatus('form');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setExtractedData(null);
    setImagePreview('');
  };

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  return (
    <>
      <div className="container">
        <img src={logo} alt="Qshala Logo" className="app-logo" />
        <h1>🚀 Qshala AI Reimbursements</h1>
        <p>Upload your invoice to begin the reimbursement process.</p>
        
        <button onClick={() => document.getElementById('fileInput').click()} disabled={isLoading}>
          {isLoading ? loadingMessage : 'Click to Upload Invoice'}
        </button>
        
        <input type="file" id="fileInput" className="hidden" onChange={handleFileChange} accept="image/*" />
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="close-button" onClick={closeModal}>&times;</span>
            
            {submissionStatus === 'loading' && (
              <div className="submission-view">
                <div className="spinner"></div>
                <h2>Submitting...</h2>
              </div>
            )}

            {submissionStatus === 'success' && (
              <div className="submission-view">
                <h2>✅ Success!</h2>
                <p>Your reimbursement has been submitted.</p>
              </div>
            )}

            {submissionStatus === 'form' && (
              <div className="modal-body">
                <div className="modal-left">
                  <img src={imagePreview} alt="Invoice Preview" className="invoice-preview-image"/>
                </div>
                <div className="modal-right">
                  <form className="verification-form" onSubmit={handleSubmit}>
                    <h2>Please Verify Details</h2>
                    {modalMessage && <div className={`message error`}>{modalMessage}</div>}
                    
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
                    <button type="submit">Confirm & Submit</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}
    </>
  );
}

export default App;