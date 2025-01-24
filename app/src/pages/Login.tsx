import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email(),
    password: z
        .string()
        .min(8)
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            {
                message:
                    'Password must contain 1 Uppercase, 1 Lowecase, 1 number and 1 special character',
            },
        ),
});

type loginSchemaT = z.infer<typeof loginSchema>;

export default function LoginPage(): JSX.Element {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<loginSchemaT>({ resolver: zodResolver(loginSchema) });
  const onSubmit = handleSubmit(async (data) => {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (res.ok) {
      const apiResponse = await res.json();
      localStorage.setItem('token', apiResponse.response.token);
      window.location.href = window.location.origin;
    }
  });

    return (
        <div className="w-full max-w-xs">
            <form
                className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
                onSubmit={onSubmit}
            >
                <div className="mb-4">
                    <label
                        className="block text-gray-700 text-sm font-bold mb-2"
                        htmlFor="email"
                    >
                        Email
                    </label>
                    <input
                        className={`shadow appearance-none border ${
                            errors.email ? 'border-red-500' : ''
                        } rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                        type="text"
                        {...register('email')}
                    />
                    {errors.email && (
                        <p className="text-red-500 text-xs italic">
                            {errors.email.message}
                        </p>
                    )}
                </div>
                <div className="mb-6">
                    <label
                        className="block text-gray-700 text-sm font-bold mb-2"
                        htmlFor="password"
                    >
                        Password
                    </label>
                    <input
                        className={`shadow appearance-none border ${
                            errors.password ? 'border-red-500' : ''
                        } rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline`}
                        type="password"
                        placeholder="******************"
                        autoComplete="current-password"
                        {...register('password')}
                    />
                    {errors.password && (
                        <p className="text-red-500 text-xs italic">
                            {errors.password.message}
                        </p>
                    )}
                </div>
                <div className="flex items-center justify-center">
                    <button
                        className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        type="submit"
                        disabled={Boolean(errors.email || errors.password)}
                    >
                        Sign In
                    </button>
                    {/* <a
                        className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                        href="#"
                    >
                        Forgot Password?
                    </a> */}
                </div>
            </form>
            <p className="text-center text-gray-500 text-xs">
                &copy;2025 Chat app. All rights reserved.
            </p>
        </div>
    );
}
