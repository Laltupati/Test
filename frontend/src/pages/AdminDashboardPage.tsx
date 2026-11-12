import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';

interface ProjectFormData {
  title: string;
  description: string;
  phase: 'Concept' | 'Dev' | 'Live';
  client_name: string;
  hours_saved: number;
  tag_names: string[];
  capabilities: string[];
  resources: { resource_type: string; url: string; embed_code: string }[];
}

const emptyForm: ProjectFormData = {
  title: '',
  description: '',
  phase: 'Concept',
  client_name: '',
  hours_saved: 0,
  tag_names: [],
  capabilities: [],
  resources: [{ resource_type: 'video', url: '', embed_code: '' }],
};

const AdminDashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [user, navigate]);

  // Scroll to form when it becomes visible
  useEffect(() => {
    if (showForm && formRef.current) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showForm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const projectsRes = await api.get<Project[]>('/admin/projects');
      setProjects(projectsRes.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        ...formData,
        tag_names: formData.tag_names,
        capabilities: formData.capabilities.filter(c => c.trim()),
        resources: formData.resources.filter(r => r.url || r.embed_code),
      };

      if (editingProject) {
        await api.put(`/admin/projects/${editingProject.id}`, payload);
      } else {
        await api.post('/admin/projects', payload);
      }

      await fetchData();
      setFormData(emptyForm);
      setEditingProject(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save project');
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      phase: project.phase as 'Concept' | 'Dev' | 'Live',
      client_name: project.client_name || '',
      hours_saved: project.hours_saved,
      tag_names: project.tags.map(t => t.name),
      capabilities: project.capabilities.map(c => c.capability),
      resources: project.resources.map(r => ({
        resource_type: r.resource_type,
        url: r.url || '',
        embed_code: r.embed_code || '',
      })),
    });
    setShowForm(true);
  };

  const handleDelete = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await api.delete(`/admin/projects/${projectId}`);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete project');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const addResource = () => {
    setFormData({
      ...formData,
      resources: [...formData.resources, { resource_type: 'video', url: '', embed_code: '' }],
    });
  };

  const removeResource = (index: number) => {
    setFormData({
      ...formData,
      resources: formData.resources.filter((_, i) => i !== index),
    });
  };

  const updateResource = (index: number, field: string, value: string) => {
    const newResources = [...formData.resources];
    newResources[index] = { ...newResources[index], [field]: value };
    setFormData({ ...formData, resources: newResources });
  };

  const addCapability = () => {
    setFormData({ ...formData, capabilities: [...formData.capabilities, ''] });
  };

  const removeCapability = (index: number) => {
    setFormData({ ...formData, capabilities: formData.capabilities.filter((_, i) => i !== index) });
  };

  const updateCapability = (index: number, value: string) => {
    const newCaps = [...formData.capabilities];
    newCaps[index] = value;
    setFormData({ ...formData, capabilities: newCaps });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-sm text-slate-600">Loading...</p>
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
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-300 transition-colors flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-users-gear text-slate-500"></i>
              <span>Manage Users</span>
            </button>
            <button
              onClick={handleBackToDashboard}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i>
              Back to Dashboard
            </button>
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Projects</h2>
          <button
            onClick={() => {
              setEditingProject(null);
              setFormData(emptyForm);
              setShowForm(!showForm);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            {showForm ? 'Cancel' : 'Add Project'}
          </button>
        </div>

        {/* Project Form */}
        {showForm && (
          <div ref={formRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingProject ? 'Edit Project' : 'New Project'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phase</label>
                  <select
                    value={formData.phase}
                    onChange={(e) => setFormData({ ...formData, phase: e.target.value as 'Concept' | 'Dev' | 'Live' })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Concept">Concept</option>
                    <option value="Dev">Dev</option>
                    <option value="Live">Live</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hours Saved</label>
                  <input
                    type="number"
                    value={formData.hours_saved}
                    onChange={(e) => setFormData({ ...formData, hours_saved: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    id="tag-input"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Type a tag and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const value = input.value.trim();
                        if (value && !formData.tag_names.includes(value)) {
                          setFormData({ ...formData, tag_names: [...formData.tag_names, value] });
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('tag-input') as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !formData.tag_names.includes(value)) {
                        setFormData({ ...formData, tag_names: [...formData.tag_names, value] });
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tag_names.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, tag_names: formData.tag_names.filter((_, i) => i !== index) })}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capabilities</label>
                {formData.capabilities.map((cap, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={cap}
                      onChange={(e) => updateCapability(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Capability"
                    />
                    <button
                      type="button"
                      onClick={() => removeCapability(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCapability}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Capability
                </button>
              </div>

              {/* Resources */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resources</label>
                {formData.resources.map((resource, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                        <select
                          value={resource.resource_type}
                          onChange={(e) => updateResource(index, 'resource_type', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="video">Video</option>
                          <option value="docs">Docs</option>
                          <option value="github">GitHub</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
                        <input
                          type="text"
                          value={resource.url}
                          onChange={(e) => updateResource(index, 'url', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="https://www.youtube.com/watch?v=... or SharePoint/OneDrive video link"
                        />
                        {resource.resource_type === 'video' && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Paste a YouTube, Vimeo, SharePoint, or OneDrive video link — it will auto-convert for playback
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Embed Code (optional)</label>
                        <textarea
                          value={resource.embed_code}
                          onChange={(e) => updateResource(index, 'embed_code', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder='<iframe ...></iframe> (leave blank to use URL)'
                        />
                      </div>
                    </div>
                    {formData.resources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeResource(index)}
                        className="mt-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addResource}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Resource
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProject(null);
                    setFormData(emptyForm);
                  }}
                  className="text-slate-600 hover:text-slate-700 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hours Saved</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{project.title}</div>
                    <div className="text-sm text-slate-500 truncate max-w-xs">{project.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {project.client_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.phase === 'Concept' ? 'bg-blue-100 text-blue-700' :
                      project.phase === 'Dev' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {project.phase}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {project.hours_saved} hrs
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(project)}
                      className="text-blue-600 hover:text-blue-700 mr-3"
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No projects found. Create your first project above.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
