"use client";

import { useMemo, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import type { LayerComposition } from "@/lib/types/layer-composition";
import { ASPECT_RATIOS } from "@/lib/types/layer-composition";
import { EditorPanel } from "./EditorPanel";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  showGuides: boolean;
  onToggleGuides: () => void;
}

export function BackgroundPanel({ composition, onChange, showGuides, onToggleGuides }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const aspect = ASPECT_RATIOS[composition.aspectRatio].width / ASPECT_RATIOS[composition.aspectRatio].height;
  const cropArea = composition.background.cropArea;

  const initialCroppedAreaPercentages = useMemo<Area>(() => ({
    x: cropArea.x * 100,
    y: cropArea.y * 100,
    width: cropArea.width * 100,
    height: cropArea.height * 100,
  }), [cropArea.height, cropArea.width, cropArea.x, cropArea.y]);

  const cropKey = `${composition.background.photoUrl}-${composition.aspectRatio}`;

  return (
    <EditorPanel
      title="Background"
      defaultOpen
      action={(
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleGuides();
          }}
          className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
            showGuides
              ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
              : "border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          {showGuides ? "Guias on" : "Guias off"}
        </button>
      )}
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-black">
          <div className="relative h-[280px]">
            <Cropper
              key={cropKey}
              image={composition.background.photoUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={3}
              restrictPosition={false}
              showGrid
              initialCroppedAreaPercentages={initialCroppedAreaPercentages}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(croppedAreaPercentages) => {
                onChange({
                  ...composition,
                  background: {
                    ...composition.background,
                    cropArea: {
                      x: croppedAreaPercentages.x / 100,
                      y: croppedAreaPercentages.y / 100,
                      width: croppedAreaPercentages.width / 100,
                      height: croppedAreaPercentages.height / 100,
                    },
                    focalPoint: {
                      x: (croppedAreaPercentages.x + croppedAreaPercentages.width / 2) / 100,
                      y: (croppedAreaPercentages.y + croppedAreaPercentages.height / 2) / 100,
                    },
                  },
                });
              }}
              style={{
                containerStyle: { background: "#020617" },
                cropAreaStyle: {
                  border: "2px solid rgba(34, 211, 238, 0.65)",
                  boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.72)",
                },
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={`Zoom (${zoom.toFixed(2)}x)`}>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-cyan-500"
            />
          </Field>
          <Field label="Reset">
            <button
              type="button"
              onClick={() => {
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                onChange({
                  ...composition,
                  background: {
                    ...composition.background,
                    cropArea: { x: 0, y: 0, width: 1, height: 1 },
                    focalPoint: { x: 0.5, y: 0.5 },
                  },
                });
              }}
              className="h-9 w-full rounded-lg border border-slate-700 text-xs text-slate-300 transition-colors hover:bg-slate-800"
            >
              Resetar enquadramento
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={`Foco X (${Math.round(composition.background.focalPoint.x * 100)}%)`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={composition.background.focalPoint.x}
              onChange={(event) => onChange({
                ...composition,
                background: {
                  ...composition.background,
                  focalPoint: { ...composition.background.focalPoint, x: Number(event.target.value) },
                  cropArea: recenterCrop(composition.background.cropArea, Number(event.target.value), composition.background.focalPoint.y),
                },
              })}
              className="w-full accent-cyan-500"
            />
          </Field>
          <Field label={`Foco Y (${Math.round(composition.background.focalPoint.y * 100)}%)`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={composition.background.focalPoint.y}
              onChange={(event) => onChange({
                ...composition,
                background: {
                  ...composition.background,
                  focalPoint: { ...composition.background.focalPoint, y: Number(event.target.value) },
                  cropArea: recenterCrop(composition.background.cropArea, composition.background.focalPoint.x, Number(event.target.value)),
                },
              })}
              className="w-full accent-cyan-500"
            />
          </Field>
        </div>
      </div>
    </EditorPanel>
  );
}

function recenterCrop(cropArea: LayerComposition["background"]["cropArea"], focalX: number, focalY: number) {
  const nextX = Math.max(0, Math.min(focalX - cropArea.width / 2, 1 - cropArea.width));
  const nextY = Math.max(0, Math.min(focalY - cropArea.height / 2, 1 - cropArea.height));

  return {
    ...cropArea,
    x: nextX,
    y: nextY,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}
