import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, Field, Notice, TextInput } from '../components/ui';
import { api } from '../lib/api';
import { errorMessage } from '../lib/format';
import { queryClient } from '../lib/query';
import type { User } from '../lib/types';

function Frame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-moss p-10 text-white md:flex">
        <p className="font-serif text-3xl">TeamFlow</p>
        <div>
          <p className="max-w-md font-serif text-4xl leading-tight">The other organization cannot see this board.</p>
          <p className="mt-4 max-w-sm text-sm text-white/80">
            Projects, tasks, comments, and the history of who moved them. One login, many organizations.
          </p>
        </div>
        <p className="text-sm text-white/70">Seed users live in the README.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="font-serif text-2xl text-moss md:hidden">TeamFlow</p>
          <h1 className="mt-4 text-2xl font-medium">{title}</h1>
          <p className="mt-1 text-sm text-muted">{lede}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const login = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) =>
      (await api.post<{ data: User }>('/auth/login', values)).data.data,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
      navigate(params.get('next') || '/dashboard');
    },
  });

  return (
    <Frame title="Log in" lede="Pick up the board where you left it.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <Field label="Email" hint={form.formState.errors.email?.message}>
          <TextInput type="email" {...form.register('email')} />
        </Field>
        <Field label="Password" hint={form.formState.errors.password?.message}>
          <TextInput type="password" {...form.register('password')} />
        </Field>
        {login.isError ? <Notice>{errorMessage(login.error)}</Notice> : null}
        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link className="text-moss" to="/forgot-password">Forgot password</Link>
        <span> · </span>
        <Link className="text-moss" to="/register">Create an account</Link>
      </p>
    </Frame>
  );
}

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Name is too short'),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
});

export function RegisterPage() {
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const register = useMutation({
    mutationFn: async (values: z.infer<typeof registerSchema>) =>
      (await api.post<{ data: User }>('/auth/register', values)).data.data,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
      navigate('/dashboard');
    },
  });

  return (
    <Frame title="Create an account" lede="You can start an organization right after this.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <Field label="Name" hint={form.formState.errors.name?.message}>
          <TextInput {...form.register('name')} />
        </Field>
        <Field label="Email" hint={form.formState.errors.email?.message}>
          <TextInput type="email" {...form.register('email')} />
        </Field>
        <Field label="Password" hint={form.formState.errors.password?.message}>
          <TextInput type="password" {...form.register('password')} />
        </Field>
        {register.isError ? <Notice>{errorMessage(register.error)}</Notice> : null}
        <Button type="submit" disabled={register.isPending} className="w-full">
          {register.isPending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already registered? <Link className="text-moss" to="/login">Log in</Link>
      </p>
    </Frame>
  );
}

export function ForgotPage() {
  const form = useForm({ resolver: zodResolver(z.object({ email: z.string().email() })), defaultValues: { email: '' } });
  const send = useMutation({
    mutationFn: (values: { email: string }) => api.post('/auth/forgot-password', values),
  });

  return (
    <Frame title="Reset password" lede="If the account exists, we send a link. The response is the same either way.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => send.mutate(values))}>
        <Field label="Email">
          <TextInput type="email" {...form.register('email')} />
        </Field>
        {send.isSuccess ? <p className="text-sm">Check your inbox. In local dev the link is printed in the API log.</p> : null}
        {send.isError ? <Notice>{errorMessage(send.error)}</Notice> : null}
        <Button type="submit" disabled={send.isPending}>Send reset link</Button>
      </form>
    </Frame>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(z.object({ password: z.string().min(8).max(72) })),
    defaultValues: { password: '' },
  });
  const reset = useMutation({
    mutationFn: (values: { password: string }) =>
      api.post('/auth/reset-password', { token: params.get('token'), password: values.password }),
    onSuccess: () => navigate('/login'),
  });

  return (
    <Frame title="Choose a new password" lede="This also logs out your other sessions.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => reset.mutate(values))}>
        <Field label="New password" hint={form.formState.errors.password?.message}>
          <TextInput type="password" {...form.register('password')} />
        </Field>
        {reset.isError ? <Notice>{errorMessage(reset.error)}</Notice> : null}
        <Button type="submit" disabled={reset.isPending}>Update password</Button>
      </form>
    </Frame>
  );
}

export function VerifyPage() {
  const [params] = useSearchParams();
  const verify = useMutation({
    mutationFn: () => api.post('/auth/verify-email', { token: params.get('token') }),
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !params.get('token')) return;
    started.current = true;
    verify.mutate();
  }, [params, verify]);

  return (
    <Frame title="Email verification" lede="This confirms the address on your account.">
      {verify.isPending ? <p className="text-sm">Checking the link…</p> : null}
      {verify.isSuccess ? <p className="text-sm">Email verified. <Link className="text-moss" to="/dashboard">Go to the app</Link></p> : null}
      {verify.isError ? <Notice>{errorMessage(verify.error)}</Notice> : null}
    </Frame>
  );
}
