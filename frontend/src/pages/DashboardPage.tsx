import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/layout/Navbar';
import HeroSummary from '../components/layout/HeroSummary';
import TagNav from '../components/projects/TagNav';
import ProjectCard from '../components/projects/ProjectCard';
import SplitModal from '../components/projects/SplitModal';
import api from '../services/api';
import type { Project } from '../types';

const DashboardPage: React.FC = () => {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 8;

  useEffect(() => {
    fetchAllProjects();
  }, []);

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get<Project[]>('/projects');
      setAllProjects(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering for smooth UX
  const filteredProjects = useMemo(() => {
    let result = allProjects;

    // Filter by phase
    if (activePhase) {
      result = result.filter(p => p.phase === activePhase);
    }

    // Filter by tag
    if (activeTag !== 'all') {
      result = result.filter(p => p.tags.some(t => t.name === activeTag));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(t => t.name.toLowerCase().includes(query))
      );
    }

    return result;
  }, [allProjects, activeTag, activePhase, searchQuery]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allProjects.forEach(p => p.tags.forEach(t => tagSet.add(t.name)));
    return Array.from(tagSet).sort();
  }, [allProjects]);

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
  };

  const handleTagSelect = (tag: string) => {
    setActiveTag(tag);
    setActivePhase(null);
    setCurrentPage(1);
  };

  const handlePhaseFilter = (phase: string | null) => {
    setActivePhase(phase);
    setActiveTag('all');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-sm text-slate-600">Loading AI Initiatives...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-4"></i>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + projectsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
            currentPage === i
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onSearch={setSearchQuery} searchQuery={searchQuery} />
      <HeroSummary
        projects={allProjects}
        onFilterByPhase={handlePhaseFilter}
        activePhaseFilter={activePhase}
      />
      <TagNav tags={allTags} activeTag={activeTag} onTagSelect={handleTagSelect} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <section id="ai-initiatives-section" className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {paginatedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <i className="fa-solid fa-magnifying-glass-triangle text-4xl text-slate-300 mb-3"></i>
              <h3 className="text-base font-bold text-slate-700">No matching AI projects found</h3>
              <p className="text-xs text-slate-500 mt-1">Try resetting search parameters or selecting "Show All Solutions".</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  currentPage === 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className="fa-solid fa-chevron-left mr-1"></i> Previous
              </button>

              {renderPageNumbers()}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  currentPage === totalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Next <i className="fa-solid fa-chevron-right ml-1"></i>
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 QualiVerse AI Platform | Enterprise Architecture Solutions</p>
        </div>
      </footer>

      <SplitModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default DashboardPage;
