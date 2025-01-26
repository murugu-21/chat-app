import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ position = 'bottom-center', ...props }: ToasterProps) => {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            position={position}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:bg-black group-[.toaster]:text-white',
                    description: 'group-[.toast]:text-gray-500',
                    actionButton:
                        'group-[.toast]:bg-white group-[.toast]:text-black',
                    cancelButton:
                        'group-[.toast]:bg-white group-[.toast]:text-black',
                },
            }}
            {...props}
        />
    );
};

export { Toaster, toast };
