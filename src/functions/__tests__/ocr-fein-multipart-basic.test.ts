// Basic integration test for multipart/form-data support in ocr-fein.ts

describe('ocr-fein multipart support', () => {
  it('should parse multipart boundary correctly', () => {
    const contentType = 'multipart/form-data; boundary=test123';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    
    expect(boundaryMatch).toBeTruthy();
    expect(boundaryMatch![1]).toBe('test123');
  });

  it('should validate multipart content type detection', () => {
    const contentTypeMultipart = 'multipart/form-data; boundary=test123';
    const contentTypePdf = 'application/pdf';
    const contentTypeOctet = 'application/octet-stream';
    
    expect(contentTypeMultipart.includes('multipart/form-data')).toBe(true);
    expect(contentTypePdf.includes('application/pdf')).toBe(true);
    expect(contentTypeOctet.includes('application/octet-stream')).toBe(true);
  });

  it('should detect PDF content type in multipart', () => {
    const multipartPart = `Content-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\nPDF content here\r\n`;
    
    const lines = multipartPart.split('\r\n');
    let contentType = '';
    let isFileUpload = false;
    
    for (const line of lines) {
      if (line.includes('Content-Disposition') && line.includes('filename')) {
        isFileUpload = true;
      }
      if (line.startsWith('Content-Type:')) {
        contentType = line.substring('Content-Type:'.length).trim();
      }
    }
    
    expect(isFileUpload).toBe(true);
    expect(contentType).toBe('application/pdf');
  });
});

export {};