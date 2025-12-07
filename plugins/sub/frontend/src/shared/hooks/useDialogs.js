import { useState } from 'react';
export function useDialogs() {
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [alertDialog, setAlertDialog] = useState(null);
    const showConfirm = (title, message, onConfirm) => {
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
    const showAlert = (title, message, variant) => {
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
