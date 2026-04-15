import RoleLoginForm from '@/app/components/RoleLoginForm';

export default function LoginPage() {
  return (
    <RoleLoginForm
      title="Customer Sign In"
      subtitle="Manage your bookings, requests, and account details"
      allowedRoles={['customer']}
      redirectByRole={{ customer: '/account' }}
      showSignupLink
      footerLinks={[
        { href: '/employee/login', label: 'Employee Login' },
        { href: '/admin/login', label: 'Admin Login' },
      ]}
    />
  );
}
