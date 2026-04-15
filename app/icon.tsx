import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, rgba(250,244,235,1) 0%, rgba(242,232,219,1) 100%)",
          color: "#8f4e29",
          borderRadius: "112px",
          fontSize: 184,
          fontWeight: 700,
          letterSpacing: -8,
        }}
      >
        HV
      </div>
    ),
    size,
  );
}
