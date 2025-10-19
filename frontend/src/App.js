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
  const [modalMessage, setModalMessage] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('form');

  // ✅ NEW: useEffect to handle auto-hiding toast messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 4000); // Message will disappear after 4 seconds
      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [message]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setMessage('');
    setSubmissionStatus('form');
    setModalMessage('');
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/process-invoice/`, formData);
      if (!response.data.amount || response.data.amount === 0) {
        setModalMessage("AI couldn't read the details. Please fill them in manually.");
      }
      setExtractedData(response.data);
      setIsModalOpen(true);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
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
        setMessage('Successfully submitted reimbursement!'); // This will now become a toast
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
    // We add a fragment <> to hold the app and the toast message
    <>
      <div className="container">
        <img src={logo} alt="Qshala Logo" className="app-logo" />
        <h1>🚀 Qshala AI Reimbursements</h1>
        <p>Upload your invoice to begin the reimbursement process.</p>
        
        <button onClick={() => document.getElementById('fileInput').click()} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Click to Upload Invoice'}
        </button>
        
        <input type="file" id="fileInput" className="hidden" onChange={handleFileChange} accept="image/*" />
      </div>

      {isModalOpen && (
         <div className="modal-overlay">
          {/* ... (The entire modal-content div and its contents remain exactly the same) ... */}
         </div>
      )}
      
      {/* ✅ NEW: Toast message will appear here, styled by CSS */}
      {message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}
    </>
  );
}

export default App;