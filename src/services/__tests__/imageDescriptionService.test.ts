import { imageDescriptionService, ImageDescriptionService } from '../imageDescriptionService';

// Mock File constructor for tests
class MockFile {
  name: string;
  type: string;
  size: number;

  constructor(name: string, type: string, size: number) {
    this.name = name;
    this.type = type;
    this.size = size;
  }
}

// Mock FileReader for tests
(global as any).FileReader = class {
  result: string | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  static DONE = 2;
  static EMPTY = 0;
  static LOADING = 1;

  readAsDataURL(file: any) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRwdHwkf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Mock Image constructor for tests
(global as any).Image = class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 300;
  src = '';

  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};

// Mock URL for tests
(global as any).URL = {
  createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: jest.fn(),
  prototype: {}
};

describe('ImageDescriptionService', () => {
  let service: ImageDescriptionService;

  beforeEach(() => {
    service = ImageDescriptionService.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = ImageDescriptionService.getInstance();
      const instance2 = ImageDescriptionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('isImageFile', () => {
    it('should return true for image files', () => {
      const imageFile = new MockFile('test.jpg', 'image/jpeg', 1024) as any;
      expect(ImageDescriptionService.isImageFile(imageFile)).toBe(true);
    });

    it('should return false for non-image files', () => {
      const textFile = new MockFile('test.txt', 'text/plain', 1024) as any;
      expect(ImageDescriptionService.isImageFile(textFile)).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return array of supported MIME types', () => {
      const types = ImageDescriptionService.getSupportedTypes();
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
      expect(types).toContain('image/gif');
    });
  });

  describe('describeImage', () => {
    it('should successfully describe a valid image', async () => {
      const mockFile = new MockFile('test.jpg', 'image/jpeg', 1024) as any;
      
      const result = await service.describeImage({
        file: mockFile,
        options: {
          language: 'es',
          style: 'detailed'
        }
      });

      expect(result.success).toBe(true);
      expect(result.description).toBeDefined();
      expect(result.description).toContain('imagen');
      expect(result.metadata?.fileSize).toBe(1024);
      expect(result.metadata?.mimeType).toBe('image/jpeg');
    });

    it('should reject unsupported file types', async () => {
      const mockFile = new MockFile('test.txt', 'text/plain', 1024) as any;
      
      const result = await service.describeImage({
        file: mockFile
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tipo de archivo no soportado');
    });

    it('should reject files that are too large', async () => {
      const largeFile = new MockFile('large.jpg', 'image/jpeg', 15 * 1024 * 1024) as any;
      
      const result = await service.describeImage({
        file: largeFile
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('demasiado grande');
    });

    it('should use English language when specified', async () => {
      const mockFile = new MockFile('test.jpg', 'image/jpeg', 1024) as any;
      
      const result = await service.describeImage({
        file: mockFile,
        options: {
          language: 'en',
          style: 'detailed'
        }
      });

      expect(result.success).toBe(true);
      expect(result.description).toBeDefined();
      expect(result.description).toContain('image');
    });

    it('should use brief style when specified', async () => {
      const mockFile = new MockFile('test.jpg', 'image/jpeg', 1024) as any;
      
      const result = await service.describeImage({
        file: mockFile,
        options: {
          language: 'es',
          style: 'brief'
        }
      });

      expect(result.success).toBe(true);
      expect(result.description).toBeDefined();
      // Brief descriptions should be shorter
      expect(result.description!.length).toBeLessThan(100);
    });

    it('should include processing time in metadata', async () => {
      const mockFile = new MockFile('test.jpg', 'image/jpeg', 1024) as any;
      
      const result = await service.describeImage({
        file: mockFile
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.processingTime).toBeGreaterThan(0);
    });
  });
});