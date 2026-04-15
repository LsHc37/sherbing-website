import RoleLoginForm from '@/app/components/RoleLoginForm';

export default function EmployeeLoginPage() {
  return (
    <RoleLoginForm
      title="Employee Sign In"
      subtitle="Access job applications, schedules, and assigned bookings"
      allowedRoles={['employee']}
      redirectByRole={{ employee: '/employee/dashboard' }}
      footerLinks={[
        { href: '/admin/login', label: 'Admin Login' },
        { href: '/login', label: 'Customer Login' },
      ]}
    />
  );
}
