import QRCode from "qrcode";

export async function EventQr({
  url,
  size = 220,
}: {
  url: string;
  size?: number;
}) {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: {
      dark: "#05070B",
      light: "#FFFFFF",
    },
  });

  return (
    <div className="inline-flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code for ${url}`}
        width={size}
        height={size}
        className="rounded-lg bg-white p-2 shadow-lg shadow-neon/10"
      />
    </div>
  );
}
