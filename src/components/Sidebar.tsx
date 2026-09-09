/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart3, 
  Layers, 
  Users, 
  DollarSign, 
  Calendar, 
  Coins, 
  CreditCard, 
  Wrench, 
  Package, 
  FileText, 
  Settings, 
  ShieldCheck,
  UserCheck,
  Menu,
  X,
  Flame,
  Droplets,
  Sparkle,
  Boxes,
  Truck,
  Lock,
  Wallet,
  FileCheck,
  History,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  Star,
  Send,
  Bot,
  CalendarDays,
  Coffee
} from 'lucide-react';
import { Role, User, Branch } from '../types';
import { translations } from '../mockData';
import Clean24Logo from './Clean24Logo';

interface SidebarProps {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  branches: Branch[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'en' | 'kh';
  setLang: (lang: 'en' | 'kh') => void;
  exchangeRate: number;
  onLogout?: () => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  currentRole,
  setCurrentRole,
  currentUser,
  setCurrentUser,
  users,
  activeBranchId,
  setActiveBranchId,
  branches,
  activeTab,
  setActiveTab,
  lang,
  setLang,
  onLogout,
  isCollapsed = false,
  setIsCollapsed,
  onCloseMobile
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('coffee_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'string');
        }
      }
    } catch {
      // safe fallback
    }
    return [];
  });

  const toggleFavorite = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const updated = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      try {
        localStorage.setItem('coffee_favorites', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };
  
  const t = translations[lang];

  // Navigation Items Definitions - Staff Management System
  const navItems = [
    { id: 'staff', label: lang === 'en' ? 'Barista & Staff' : 'បុគ្គលិក & Barista', icon: Users, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'shifts', label: lang === 'en' ? 'Shift Roster Calendar' : 'ប្រតិទិនវេនការងារ', icon: CalendarDays, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'attendance', label: t.attendance, icon: Calendar, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'salary', label: t.salary, icon: DollarSign, roles: ['Owner', 'Admin', 'Manager', 'Staff'] }
  ];

  const navGroups = [
    {
      title: lang === 'en' ? 'Staff & Payroll' : 'បុគ្គលិក និងប្រាក់ខែ',
      icon: Users,
      items: ['staff', 'shifts', 'attendance', 'salary']
    }
  ];

  // Helper to filter branches accessible by selected user role
  const getAccessibleBranches = () => {
    if (currentUser?.assignedBranchIds && currentUser.assignedBranchIds.length > 0) {
      return branches.filter(b => currentUser.assignedBranchIds?.includes(b.id));
    }
    return branches;
  };

  const accessibleBranches = getAccessibleBranches();

  // Handle physical user swap when switching simulated roles
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as Role;
    setCurrentRole(nextRole);
    
    const match = users.find(u => u.role === nextRole);
    if (match) {
      setCurrentUser(match);
    }

    if (nextRole === 'Manager' || nextRole === 'Staff') {
      setActiveBranchId('b1');
    } else if (nextRole === 'Admin') {
      setActiveBranchId('b1');
    } else {
      setActiveBranchId('all');
    }
  };

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  const isGroupExpanded = (groupTitle: string) => {
    if (searchQuery.trim() !== '') return true;
    return !collapsedGroups[groupTitle];
  };

  // Filter groups and items based on search and roles
  const filteredGroups = navGroups.map(group => {
    const visibleItems = group.items
      .map(itemId => navItems.find(item => item.id === itemId))
      .filter((item): item is typeof navItems[0] => {
        if (!item) return false;
        
        // Check role access
        const hasAccess = item.roles.includes(currentRole);
        if (!hasAccess) return false;
        
        // Check search query
        if (searchQuery.trim() === '') return true;
        const query = searchQuery.toLowerCase();
        return (
          item.label.toLowerCase().includes(query) ||
          group.title.toLowerCase().includes(query)
        );
      });

    return {
      ...group,
      visibleItems
    };
  }).filter(group => group.visibleItems.length > 0);

  // Filter favorites based on search, role, and active selections
  const favoriteItems = navItems.filter(item => {
    if (!favorites.includes(item.id)) return false;
    const hasAccess = item.roles.includes(currentRole);
    if (!hasAccess) return false;
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    return item.label.toLowerCase().includes(query);
  });

  const favoritesExpanded = isGroupExpanded('clean24_favorites_group');

  return (
    <aside className={`h-full bg-[#E7EEFF] text-[#111827] border-r border-blue-200/70 flex flex-col justify-between overflow-hidden shadow-xs transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-72'}`}>
      
      {/* 1. TOP HEADER BRANDING BLOCK (With Hide & Show button on the bar) */}
      <div className="p-3 border-b border-blue-200/60 bg-[#E7EEFF] shrink-0">
        
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Clean24Logo className="h-10 sm:h-12 cursor-pointer text-[#003D9B] shrink-0" lightMode={true} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-[#003D9B] tracking-tight uppercase block leading-tight font-sans">
                    P2B Laundry System
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Hide and Show button ONLY on Desktop */}
                {setIsCollapsed && (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex w-9 h-9 bg-white hover:bg-slate-50 text-[#346687] rounded-xl shadow-xs border border-slate-200/80 items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                    title="Hide / Show Sidebar"
                    id="sidebar_toggle_btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="14" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </button>
                )}

                {/* Mobile close button */}
                {onCloseMobile && (
                  <button 
                    onClick={onCloseMobile}
                    className="lg:hidden p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer transition-colors shrink-0"
                    aria-label="Close Navigation"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Active Branch Select Form */}
            <div className="mt-3 bg-white/90 p-2.5 rounded-xl border border-blue-200/80 shadow-2xs">
              <label className="text-[9px] text-[#4B5563] uppercase tracking-widest block mb-1 font-bold">
                {t.activeBranch}
              </label>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs text-[#111827] rounded-lg p-1.5 focus:outline-none focus:border-[#003D9B] font-sans cursor-pointer transition-colors font-semibold"
              >
                {(currentRole === 'Owner' || currentRole === 'Admin') && (!currentUser?.assignedBranchIds || currentUser.assignedBranchIds.length === 0) && (
                  <option value="all">🌐 {t.allBranches}</option>
                )}
                {accessibleBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    📍 {b.branchName}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* COLLAPSED HEADER: Centered White Toggle Button */
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => setIsCollapsed && setIsCollapsed(!isCollapsed)}
              className="w-10 h-10 bg-white hover:bg-slate-50 text-[#346687] rounded-xl shadow-xs border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all active:scale-95"
              title="Expand Sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="14" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        )}

      </div>

      {/* 2. SEARCH MENU FILTER BAR (When expanded) */}
      {!isCollapsed && (
        <div className="px-4 py-2 bg-[#E7EEFF] border-b border-blue-200/60 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[#4B5563]" />
            <input
              type="text"
              placeholder={lang === 'en' ? "Search menus..." : "ស្វែងរកមុខងារ..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-blue-200/80 text-xs text-[#111827] placeholder-slate-400 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#003D9B] font-sans transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-[#4B5563] hover:text-[#111827] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. DYNAMIC NAVIGATION TABS LIST */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-8 space-y-3 custom-scrollbar bg-[#E7EEFF]">
        
        {/* COLLAPSED MODE: Clean Icons with Tooltip Popup */}
        {isCollapsed ? (
          <div className="space-y-2 flex flex-col items-center">
            {navItems.filter(item => item.roles.includes(currentRole)).map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
                    active 
                      ? 'bg-[#0052CC] text-white shadow-md' 
                      : 'text-[#346687] hover:bg-white hover:text-[#0052CC] hover:shadow-xs'
                  }`}
                  title={item.label}
                >
                  <item.icon size={19} />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-14 bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-lg">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* EXPANDED MODE: Full Original Menu Feed */
          <>
            {/* Favorites Collapsible Group */}
            {favorites.length > 0 && (
              <div className="space-y-1 border-b border-blue-200/60 pb-3">
                <button
                  onClick={() => toggleGroup('clean24_favorites_group')}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-black text-[#92400E] uppercase tracking-widest hover:text-amber-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Star size={11} className="fill-[#92400E] text-[#92400E] shrink-0" />
                    <span>{lang === 'en' ? 'Favorites' : 'សំណព្វចិត្ត'}</span>
                    <span className="text-[8px] text-[#92400E] font-medium lowercase tracking-normal">
                      ({favoriteItems.length})
                    </span>
                  </div>
                  {favoritesExpanded ? <ChevronDown size={10} className="text-[#92400E]" /> : <ChevronRight size={10} className="text-[#92400E]" />}
                </button>

                {favoritesExpanded && (
                  <div className="space-y-0.5 pl-1.5 fade-in-slide">
                    {favoriteItems.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={`fav-${item.id}`}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            if (onCloseMobile) onCloseMobile();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                            ${active 
                              ? 'bg-[#0052CC] text-white font-bold shadow-md' 
                              : 'text-[#4B5563] hover:bg-blue-100/70 hover:text-[#111827]'
                            }
                          `}
                          id={`fav_tab_${item.id}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <item.icon size={18} className={active ? 'text-white' : 'text-[#003D9B] shrink-0'} />
                            <span className="truncate text-xs font-bold flex-1 text-left">{item.label}</span>
                          </div>
                          <span 
                            onClick={(e) => toggleFavorite(item.id, e)}
                            className="p-1 rounded-md hover:bg-blue-200/50 cursor-pointer transition-colors shrink-0"
                          >
                            <Star 
                              size={16} 
                              className="fill-amber-400 text-amber-400" 
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {filteredGroups.map((group) => {
              const expanded = isGroupExpanded(group.title);
              return (
                <div key={group.title} className="space-y-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-2 py-1 text-xs font-black text-[#4B5563] uppercase tracking-widest hover:text-[#111827] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <group.icon size={11} className="text-[#0052CC] shrink-0" />
                      <span>{group.title}</span>
                      <span className="text-[8px] text-[#4B5563] font-medium lowercase tracking-normal">
                        ({group.visibleItems.length})
                      </span>
                    </div>
                    {expanded ? <ChevronDown size={10} className="text-[#4B5563]" /> : <ChevronRight size={10} className="text-[#4B5563]" />}
                  </button>

                  {/* Group Items */}
                  {expanded && (
                    <div className="space-y-0.5 pl-1.5 fade-in-slide">
                      {group.visibleItems.map((item) => {
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              if (onCloseMobile) onCloseMobile();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                              ${active 
                                ? 'bg-[#0052CC] text-white font-bold shadow-md' 
                                : 'text-[#4B5563] hover:bg-blue-100/70 hover:text-[#111827]'
                              }
                            `}
                            id={`nav_tab_${item.id}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.icon size={18} className={active ? 'text-white' : 'text-[#003D9B] shrink-0'} />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <span 
                              onClick={(e) => toggleFavorite(item.id, e)}
                              className="p-1 rounded-md hover:bg-blue-200/50 cursor-pointer transition-colors shrink-0"
                            >
                              <Star 
                                size={16} 
                                className={favorites.includes(item.id) 
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity'
                                } 
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

      </div>

    </aside>
  );
}
