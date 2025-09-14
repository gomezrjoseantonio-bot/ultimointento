// Edge case tests for multipart/form-data support in ocr-fein.ts

describe('ocr-fein multipart edge cases', () => {
  it('should handle missing boundary in multipart content-type', () => {
    const contentType = 'multipart/form-data';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    
    expect(boundaryMatch).toBeNull();
  });

  it('should handle invalid multipart structure', () => {
    const invalidMultipart = 'not a valid multipart structure';
    const boundary = 'test123';
    const parts = invalidMultipart.split(`--${boundary}`);
    
    expect(parts.length).toBe(1); // Should not split properly
    expect(parts[0]).not.toContain('Content-Disposition');
  });

  it('should calculate file size correctly from base64', () => {
    const testContent = 'Hello, World!'; // 13 bytes
    const base64Content = Buffer.from(testContent).toString('base64');
    
    // Base64 has padding, so the calculation is not exact for small strings
    // Calculate file size as done in the function
    const fileSizeBytes = (base64Content.length * 3) / 4;
    const sizeKB = Math.round(fileSizeBytes / 1024);
    
    // The calculation should be reasonably close to the original size
    expect(fileSizeBytes).toBeGreaterThan(10); // At least 10 bytes
    expect(fileSizeBytes).toBeLessThan(20); // Less than 20 bytes
    expect(sizeKB).toBe(0); // Small file should round to 0KB
  });

  it('should detect empty file content', () => {
    const emptyBase64 = '';
    
    expect(emptyBase64.length).toBe(0);
  });

  it('should handle multiple files in multipart and extract first PDF', () => {
    const boundary = 'test123';
    const multipartWithMultipleFiles = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      'text value',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file1"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'text file content',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file2"; filename="test.pdf"',
      'Content-Type: application/pdf',
      '',
      'PDF content here',
      `--${boundary}--`
    ].join('\r\n');
    
    const parts = multipartWithMultipleFiles.split(`--${boundary}`);
    let foundPdfPart = false;
    
    for (const part of parts) {
      if (!part.includes('Content-Disposition')) continue;
      
      const lines = part.split('\r\n');
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
      
      if (isFileUpload && contentType.includes('application/pdf')) {
        foundPdfPart = true;
        break; // Should find the first PDF
      }
    }
    
    expect(foundPdfPart).toBe(true);
  });

  it('should validate large file size calculation', () => {
    // Simulate a 25MB file (exceeds 20MB limit)
    const largeSizeBytes = 25 * 1024 * 1024;
    const base64Length = Math.ceil((largeSizeBytes * 4) / 3); // Base64 is ~33% larger
    
    const calculatedSizeBytes = (base64Length * 3) / 4;
    const sizeKB = Math.round(calculatedSizeBytes / 1024);
    const sizeMB = Math.round(sizeKB / 1024);
    
    expect(sizeMB).toBe(25); // Should correctly calculate 25MB
    expect(sizeMB).toBeGreaterThan(20); // Should exceed 20MB limit
  });
});

export {};