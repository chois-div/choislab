"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export function SignaturePad({
  value,
  onChange,
  label = "서명을 그려 주세요",
  id = "signature-pad",
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
  id?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    };
    image.src = value;
  }, [value]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#202a32";
  }

  function continueDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing() {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (context) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasInk = pixels.some((channel, index) => index % 4 === 3 && channel > 0);
      onChange(hasInk ? canvas.toDataURL("image/png") : undefined);
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    onChange(undefined);
  }

  function importImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1_000_000) {
      setImageError("PNG 또는 JPG 이미지(1MB 이하)를 선택해 주세요.");
      event.target.value = "";
      return;
    }
    setImageError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <div className="signature-control">
      <div className="signature-caption">
        <span>{label}</span>
        <button className="text-button" type="button" onClick={clearSignature}>
          지우기
        </button>
      </div>
      <canvas
        aria-label={label}
        className="signature-canvas"
        height={150}
        id={id}
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        ref={canvasRef}
        width={720}
      />
      <div className="signature-foot">
        <span>마우스나 손가락으로 서명할 수 있습니다</span>
        <label className="text-button upload-signature" htmlFor={`${id}-image`}>
          <Icon name="upload" size={15} />
          이미지 삽입
        </label>
        <input
          accept="image/png,image/jpeg"
          className="visually-hidden"
          id={`${id}-image`}
          onChange={importImage}
          type="file"
        />
      </div>
      {imageError && <p className="form-error signature-error" role="alert">{imageError}</p>}
    </div>
  );
}
