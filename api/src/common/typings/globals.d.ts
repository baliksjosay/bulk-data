declare namespace Storage {
  interface MultipartFile {
    buffer: Buffer;
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
  }
}
