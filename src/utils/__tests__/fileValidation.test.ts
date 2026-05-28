import {
  validateFiles,
  formatFileSize,
  FILE_SIZE_LIMITS,
  MIME_TYPES,
} from 'utils/fileValidation';

/** Build a File of an exact byte size and MIME type for validation tests. */
const makeFile = (name: string, type: string, sizeBytes: number): File =>
  new File([new Uint8Array(sizeBytes)], name, { type });

describe('validateFiles', () => {
  it('accepts an allowed image under the size limit', () => {
    const result = validateFiles([makeFile('ok.png', 'image/png', 500)]);
    expect(result.validFiles).toHaveLength(1);
    expect(result.oversizedFiles).toEqual([]);
    expect(result.invalidTypeFiles).toEqual([]);
  });

  it('rejects files exceeding the size limit', () => {
    const result = validateFiles(
      [makeFile('big.png', 'image/png', 2048)],
      1024
    );
    expect(result.validFiles).toEqual([]);
    expect(result.oversizedFiles).toEqual(['big.png']);
  });

  it('rejects disallowed MIME types', () => {
    const result = validateFiles([makeFile('doc.pdf', 'application/pdf', 100)]);
    expect(result.invalidTypeFiles).toEqual(['doc.pdf']);
    expect(result.validFiles).toEqual([]);
  });

  it('classifies a wrong-type oversized file as invalid-type (type checked first)', () => {
    const result = validateFiles(
      [makeFile('huge.pdf', 'application/pdf', 999999)],
      1024
    );
    expect(result.invalidTypeFiles).toEqual(['huge.pdf']);
    expect(result.oversizedFiles).toEqual([]);
  });

  it('partitions a mixed batch correctly', () => {
    const result = validateFiles(
      [
        makeFile('good.jpg', 'image/jpeg', 100),
        makeFile('big.webp', 'image/webp', 5000),
        makeFile('bad.txt', 'text/plain', 10),
      ],
      1024
    );
    expect(result.validFiles.map(f => f.name)).toEqual(['good.jpg']);
    expect(result.oversizedFiles).toEqual(['big.webp']);
    expect(result.invalidTypeFiles).toEqual(['bad.txt']);
  });

  it('honours a custom allowed-types list', () => {
    const result = validateFiles(
      [makeFile('clip.mp4', 'video/mp4', 100)],
      FILE_SIZE_LIMITS.VIDEO_100MB,
      MIME_TYPES.VIDEOS as unknown as string[]
    );
    expect(result.validFiles).toHaveLength(1);
  });
});

describe('formatFileSize', () => {
  it('reports zero specially', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it.each([
    [512, '512 Bytes'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1 MB'],
    [5 * 1024 * 1024, '5 MB'],
    [1024 * 1024 * 1024, '1 GB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe('FILE_SIZE_LIMITS', () => {
  it('exposes the documented byte limits', () => {
    expect(FILE_SIZE_LIMITS.IMAGE_1MB).toBe(1024 * 1024);
    expect(FILE_SIZE_LIMITS.IMAGE_5MB).toBe(5 * 1024 * 1024);
  });
});
