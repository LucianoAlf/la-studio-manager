"use client";

import { useState, useCallback } from "react";
import Cropper, { Area, MediaSize } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, Check, SpinnerGap, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  profileId: string;
  onAvatarUpdated: (newUrl: string) => void;
}

// Função para criar imagem cropada
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar contexto do canvas");

  const size = 512;
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Erro ao criar blob"));
      },
      "image/jpeg",
      0.92
    );
  });
}

export function AvatarUpload({ currentAvatarUrl, profileId, onAvatarUpdated }: AvatarUploadProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Quando a mídia carrega, calcular o zoom mínimo para a imagem caber
  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    // Permitir zoom out até 60% do tamanho natural
    const naturalMin = Math.min(
      mediaSize.naturalWidth / mediaSize.width,
      mediaSize.naturalHeight / mediaSize.height
    );
    const calculatedMin = Math.max(0.4, naturalMin * 0.6);
    setMinZoom(calculatedMin);
    setZoom(1);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsModalOpen(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Resetar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setUploading(true);
      setError(null);

      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

      const supabase = createClient();
      const fileName = `${profileId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: newAvatarUrl } as never)
        .eq("id", profileId);

      if (updateError) throw new Error(updateError.message);

      onAvatarUpdated(newAvatarUrl);
      setIsModalOpen(false);
      setImageSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setImageSrc(null);
    setError(null);
  };

  return (
    <>
      {/* Avatar com botão de editar */}
      <div className="relative group">
        <div className="h-20 w-20 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-500">
              <Camera size={32} weight="duotone" />
            </div>
          )}
        </div>

        {/* Overlay de hover */}
        <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
          <Camera size={24} className="text-white" />
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Modal de Crop */}
      <AnimatePresence>
        {isModalOpen && imageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-slate-100">Ajustar foto de perfil</h3>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Área de Crop — sem cropSize fixo, sem objectFit contain */}
              <div className="relative h-[340px] bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  minZoom={minZoom}
                  maxZoom={3}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  restrictPosition={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  onMediaLoaded={onMediaLoaded}
                  style={{
                    containerStyle: { background: "#000" },
                    cropAreaStyle: {
                      border: "2px solid rgba(0, 245, 255, 0.5)",
                      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                    },
                  }}
                />
              </div>

              {/* Controle de Zoom */}
              <div className="px-5 py-3 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setZoom(Math.max(minZoom, zoom - 0.1))}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <MagnifyingGlassMinus size={20} />
                  </button>
                  <input
                    type="range"
                    min={minZoom}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-accent-cyan [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-cyan [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                  />
                  <button
                    type="button"
                    onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <MagnifyingGlassPlus size={20} />
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800">
                <button
                  onClick={closeModal}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent-cyan text-slate-900 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <SpinnerGap size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} weight="bold" />
                  )}
                  {uploading ? "Salvando..." : "Salvar foto"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
