import QRCode from "qrcode";

export async function signingQrDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
