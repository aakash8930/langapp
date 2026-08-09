declare module 'qrcode' {
  type QrCodeOptions = {
    width?: number;
    margin?: number;
  };

  const QRCode: {
    toDataURL(text: string, options?: QrCodeOptions): Promise<string>;
  };

  export default QRCode;
}
