import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

interface UserFormData {
  email: string;
  password: string;
  is_admin: boolean;
  is_active: boolean;
}

const emptyUserForm: UserFormData = {
  email: '',
  password: '',
  is_admin: false,
  is_active: true,
};

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyUserForm);
  const [showForm, setShowForm] = useState(false);
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser?.is_admin) {
      navigate('/admin/login');
      return;
    }
    fetchUsers();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (showForm && formRef.current) {
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showForm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<User[]>('/admin/users');
      setUsers(res.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        const payload: any = {
          email: formData.email,
          is_admin: formData.is_admin,
          is_active: formData.is_active,
        };
        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }
        await api.put(`/admin/users/${editingUser.id}`, payload);
        setSuccess('User updated successfully');
      } else {
        await api.post('/admin/users', formData);
        setSuccess('User created successfully');
      }

      await fetchUsers();
      setFormData(emptyUserForm);
      setEditingUser(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleEdit = (targetUser: User) => {
    setEditingUser(targetUser);
    setFormData({
      email: targetUser.email,
      password: '',
      is_admin: targetUser.is_admin,
      is_active: targetUser.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: number, email: string) => {
    if (email.toLowerCase() === currentUser?.email.toLowerCase()) {
      alert('You cannot delete your own logged-in admin account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      setSuccess(`User ${email} deleted successfully`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-sm text-slate-600">Loading User Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <i className="fa-solid fa-users-gear"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900">User Management</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium flex items-center space-x-1"
            >
              <i className="fa-solid fa-folder-kanban mr-1"></i>
              Projects Management
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i>
              Back to App
            </button>
            <span className="text-sm text-slate-600">{currentUser?.email}</span>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Users</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage user accounts, admin roles, and active statuses</p>
          </div>
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData(emptyUserForm);
              setShowForm(!showForm);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
          >
            <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-user-plus'}`}></i>
            <span>{showForm ? 'Cancel' : 'Add User'}</span>
          </button>
        </div>

        {/* User Form */}
        {showForm && (
          <div ref={formRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingUser ? `Edit User (${editingUser.email})` : 'Create New User'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="user@kpmg.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password {editingUser && <span className="text-slate-400 font-normal">(leave blank to keep unchanged)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Grant Admin Privileges</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Account Active</span>
                </label>
              </div>

              <div className="flex items-center space-x-4 pt-2">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                    setFormData(emptyUserForm);
                  }}
                  className="text-slate-600 hover:text-slate-700 font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">#{u.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-900">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      u.is_admin ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      u.is_active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(u)}
                      className="text-blue-600 hover:text-blue-700 mr-4 font-semibold text-xs"
                    >
                      <i className="fa-solid fa-pen-to-square mr-1"></i> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      className="text-red-600 hover:text-red-700 font-semibold text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={u.email.toLowerCase() === currentUser?.email.toLowerCase()}
                      title={u.email.toLowerCase() === currentUser?.email.toLowerCase() ? "Cannot delete your own account" : "Delete user"}
                    >
                      <i className="fa-solid fa-trash mr-1"></i> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No users found.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminUsersPage;
