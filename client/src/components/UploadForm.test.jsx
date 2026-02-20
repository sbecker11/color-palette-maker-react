import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadForm from './UploadForm';

describe('UploadForm', () => {
  it('renders Source heading', () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Source');
  });

  it('renders URL and file radio options', () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    expect(screen.getByLabelText(/download from url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload local file/i)).toBeInTheDocument();
  });

  it('starts with URL mode selected', () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    expect(screen.getByLabelText(/download from url/i)).toBeChecked();
  });

  it('switches to file mode when file radio is clicked', () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.click(screen.getByLabelText(/upload local file/i));
    expect(screen.getByLabelText(/upload local file/i)).toBeChecked();
  });

  it('calls onSubmit with error when URL is empty and form is submitted', async () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      success: false,
      message: 'Image URL is required.',
    });
  });

  it('calls onSubmit with error when file mode and no file selected', async () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.click(screen.getByLabelText(/upload local file/i));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      success: false,
      message: 'Please select a file.',
    });
  });

  it('calls onSubmit with FormData when URL is provided', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    const urlInput = screen.getByLabelText(/image url/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/image.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalled();
    const formData = onSubmit.mock.calls[0][0];
    expect(formData.get('uploadType')).toBe('url');
    expect(formData.get('imageUrl')).toBe('https://example.com/image.jpg');
  });

  it('calls onSubmit with FormData when file is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.click(screen.getByLabelText(/upload local file/i));
    const fileInput = screen.getByLabelText(/select file/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalled();
    const formData = onSubmit.mock.calls[0][0];
    expect(formData.get('uploadType')).toBe('file');
    expect(formData.get('imageFile')).toBe(file);
  });

  it('resets form after successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    const urlInput = screen.getByLabelText(/image url/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/img.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await screen.findByDisplayValue('');
    expect(urlInput).toHaveValue('');
  });

  it('does not reset form when submit fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false });
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    const urlInput = screen.getByLabelText(/image url/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/img.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toHaveTextContent('Submit'));
    expect(urlInput).toHaveValue('https://example.com/img.jpg');
  });

  it('displays message text', () => {
    render(
      <UploadForm
        onSubmit={vi.fn()}
        message={{ text: 'Upload success!', isError: false }}
      />
    );
    expect(screen.getByText('Upload success!')).toBeInTheDocument();
  });

  it('applies message-error class when message is error', () => {
    render(
      <UploadForm
        onSubmit={vi.fn()}
        message={{ text: 'Error occurred', isError: true }}
      />
    );
    const msgArea = screen.getByText('Error occurred').closest('.messageArea');
    expect(msgArea).toHaveClass('message-error');
  });

  it('ignores submit when already submitting', async () => {
    const onSubmit = vi.fn(() => new Promise((r) => setTimeout(r, 200)));
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.com/x.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    const processingBtn = await screen.findByRole('button', { name: /processing/i });
    fireEvent.click(processingBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('handles file input change with empty files', () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.click(screen.getByLabelText(/upload local file/i));
    const fileInput = screen.getByLabelText(/select file/i);
    fireEvent.change(fileInput, { target: { files: [new File([], 'x.png')] } });
    fireEvent.change(fileInput, { target: { files: [] } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({ success: false, message: 'Please select a file.' });
  });

  it('shows Processing... on submit button when submitting', async () => {
    const onSubmit = vi.fn(() => new Promise((r) => setTimeout(r, 10)));
    render(<UploadForm onSubmit={onSubmit} message={{ text: '', isError: false }} />);
    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.com/x.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
  });
});
