// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logo from './Qshala_logo.gif'; // ✅ IMPORT THE LOGO

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const REIMBURSEMENT_TYPES = [
  'Travel', 'Hotel & Accommodation', 'Food', 'Medical', 'Telephone', 'Fuel',
  'Imprest', 'Other', 'Air Ticket', 'Postage/courier/transport/delivery charges',
  'Printing and stationery for quiz', 'Train Ticket'
];

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setIsLoading(true);
    setMessage('');
    setExtractedData(null);
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/process-invoice/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExtractedData(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
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
        setMessage('Error: Amount is missing or invalid. Please enter a valid amount.');
        return;
    }
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await axios.post(`${API_URL}/api/create-reimbursement/`, extractedData);
      setMessage(`Success! ${response.data.message}`);
      setExtractedData(null);
      setSelectedFile(null);
      setImagePreview('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unexpected error occurred.';
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
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
      {/* ✅ ADD THE IMAGE TAG */}
      <img src={logo} alt="Qshala Logo" className="app-logo" />
      <h1>📄 AI Reimbursement Uploader</h1>

      {!extractedData && !isLoading && (
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

      {isLoading && <div className="spinner">Processing... 🤖</div>}
      {message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}

      {extractedData && !isLoading && (
        <form className="verification-form" onSubmit={handleSubmit}>
          <h2>Please Verify Details</h2>
          
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
              type="number"
              id="amount"
              name="amount"
              value={extractedData.amount || ''}
              onChange={handleInputChange}
              step="0.01"
              placeholder="e.g., 150.50"
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={extractedData.description || ''}
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