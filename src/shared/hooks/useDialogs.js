import { useState } from 'react';
export const useDialogs = () => {
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [alertDialog, setAlertDialog] = useState(null);
    const [promptDialog, setPromptDialogState] = useState(null);
    const showConfirm = (title, message, onConfirm, variant = 'danger') => {
        setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
    };
    const hideConfirm = () => {
        setConfirmDialog(null);
    };
    const showAlert = (title, message, variant = 'info') => {
        setAlertDialog({ isOpen: true, title, message, variant });
    };
    const hideAlert = () => {
        setAlertDialog(null);
    };
    const showPrompt = (title, message, onConfirm, defaultValue, placeholder) => {
        setPromptDialogState({
            isOpen: true,
            title,
            message,
            onConfirm,
            defaultValue,
            placeholder
        });
    };
    const hidePrompt = () => {
        setPromptDialogState(null);
    };
    return {
        // State
        confirmDialog,
        alertDialog,
        promptDialog,
        // Methods
        showConfirm,
        hideConfirm,
        showAlert,
        hideAlert,
        showPrompt,
        hidePrompt,
    };
};
