import { useState } from 'react';

function UploadForm({ onSubmit, message }) {
  const [uploadType, setUploadType] = useState('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData();
    formData.append('uploadType', uploadType);

    if (uploadType === 'url') {
      if (!imageUrl.trim()) {
        onSubmit?.({ success: false, message: 'Image URL is required.' });
        return;
      }
      formData.append('imageUrl', imageUrl.trim());
    } else {
      if (!imageFile) {
        onSubmit?.({ success: false, message: 'Please select a file.' });
        return;
      }
      formData.append('imageFile', imageFile);
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (result?.success) {
        setImageUrl('');
        setImageFile(null);
        setUploadType('url');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="controls">
      <h2>Source</h2>
      <form id="uploadForm" onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="radio"
            id="uploadTypeUrl"
            name="uploadType"
            value="url"
            checked={uploadType === 'url'}
            onChange={() => setUploadType('url')}
          />
          <label htmlFor="uploadTypeUrl">Download from URL</label>
          <br />
          <input
            type="radio"
            id="uploadTypeFile"
            name="uploadType"
            value="file"
            checked={uploadType === 'file'}
            onChange={() => setUploadType('file')}
          />
          <label htmlFor="uploadTypeFile">Upload Local File</label>
        </div>

        <div
          id="fileInputGroup"
          className={`input-group ${uploadType === 'file' ? '' : 'hidden'}`}
        >
          <label htmlFor="imageFile">Select File:</label>
          <br />
          <input
            type="file"
            id="imageFile"
            name="imageFile"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
        </div>

        <div
          id="urlInputGroup"
          className={`input-group ${uploadType === 'url' ? '' : 'hidden'}`}
        >
          <label htmlFor="imageUrl">Image URL:</label>
          <br />
          <input
            type="text"
            id="imageUrl"
            name="imageUrl"
            size="50"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Submit'}
          </button>
          <div
            id="messageArea"
            className={`messageArea ${message?.isError ? 'message-error' : 'message-success'}`}
          >
            {message?.text || ''}
          </div>
        </div>
      </form>
    </div>
  );
}

export default UploadForm;
