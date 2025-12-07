import { useState } from 'react';

export interface DialogState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

export function useDialogs() {
    const [confirmDialog, setConfirmDialog] = useState<DialogState | null>(null);
    const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; title: string; message: string; variant?: string } | null>(null);

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm
        });
    };

    const hideConfirm = () => {
        setConfirmDialog(null);
    };

    const showAlert = (title: string, message: string, variant?: string) => {
        setAlertDialog({
            isOpen: true,
            title,
            message,
            variant
        });
    };

    const hideAlert = () => {
        setAlertDialog(null);
    };

    return {
        confirmDialog,
        showConfirm,
        hideConfirm,
        alertDialog,
        showAlert,
        hideAlert
    };
}
