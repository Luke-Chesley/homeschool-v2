import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6efe5",
          color: "#8f4e29",
          borderRadius: 44,
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        HV
      </div>
    ),
    size,
  );
}
