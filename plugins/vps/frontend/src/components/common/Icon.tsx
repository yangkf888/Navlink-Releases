import React from 'react';

interface IconProps {
    icon: string;
    className?: string;
    onClick?: () => void;
}

export const Icon: React.FC<IconProps> = ({ icon, className = '', onClick }) => {
    return <i className={`${icon} ${className}`} onClick={onClick}></i>;
};
