import { Config } from '@/shared/types/config';

export interface AdminTabProps {
    config: Config;
    update: (updater: (c: Config) => Config) => void;
}
