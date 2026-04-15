import RoleLoginForm from '@/app/components/RoleLoginForm';

export default function AdminLoginPage() {
  return (
    <RoleLoginForm
      title="Admin Sign In"
      subtitle="Access admin tools, user management, and job application review"
      allowedRoles={['admin']}
      redirectByRole={{ admin: '/admin/users' }}
      footerLinks={[
        { href: '/employee/login', label: 'Employee Login' },
        { href: '/login', label: 'Customer Login' },
      ]}
    />
  );
}
