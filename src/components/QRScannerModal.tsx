import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useI18n } from '../lib/i18n';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (text: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const html5Qrcode = new Html5Qrcode('qr-reader-container');

    html5Qrcode.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText) => {
        onScanSuccess(decodedText);
        html5Qrcode.stop().then(() => onClose()).catch(() => {});
      },
      () => {}
    ).catch(err => {
      console.warn('摄像头唤起失败，提供相册选择兜底:', err);
    });

    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => {});
      }
    };
  }, [isOpen]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const decoder = new Html5Qrcode('qr-reader-container');
    decoder.scanFile(file, true)
      .then(text => {
        onScanSuccess(text);
        onClose();
      })
      .catch(() => {
        alert('无法识别该图片中的二维码');
        if (e.target) e.target.value = '';
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 shadow-2xl">
        <h3 className="text-md font-bold text-center text-gray-900 dark:text-white mb-4">
          📷 {t.scanTitle}
        </h3>

        <div id="qr-reader-container" className="overflow-hidden rounded-2xl bg-gray-900 aspect-square w-full mb-4" />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFile}
          accept="image/*"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-xs transition mb-2 cursor-pointer"
        >
          {t.chooseFromAlbum}
        </button>

        <button
          onClick={onClose}
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
};