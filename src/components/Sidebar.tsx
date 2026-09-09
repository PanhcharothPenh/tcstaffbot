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
  Coffee,
  MapPin,
  Building2,
  LayoutDashboard
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

  // Navigation Items Definitions - Pure Staff Management Suite
  const navItems = [
    { id: 'staff', label: lang === 'en' ? 'Staff & Baristas' : 'បុគ្គលិក & Barista', icon: Users, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'shifts', label: lang === 'en' ? 'Shift Roster Calendar' : 'ប្រតិទិនវេនការងារ', icon: CalendarDays, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'attendance', label: t.attendance, icon: Calendar, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'salary', label: t.salary, icon: DollarSign, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'branches', label: lang === 'en' ? 'Branch & GPS Setup' : 'សាខា & ទីតាំងស្កេន GPS', icon: MapPin, roles: ['Owner', 'Admin'] },
    { id: 'users', label: lang === 'en' ? 'User Accounts & Roles' : 'គណនី & សិទ្ធិប្រើប្រាស់', icon: ShieldCheck, roles: ['Owner', 'Admin'] }
  ];

  const navGroups = [
    {
      title: lang === 'en' ? 'Staff & Payroll Management' : 'គ្រប់គ្រងបុគ្គលិក និងប្រាក់ខែ',
      icon: Users,
      items: ['staff', 'shifts', 'attendance', 'salary', 'branches', 'users']
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
    <aside className={`h-full bg-[#0F172A] text-slate-100 border-r border-slate-800 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-72'}`}>
      
      {/* 1. TOP HEADER BRANDING BLOCK */}
      <div className="p-3.5 border-b border-slate-800 bg-[#0B1120] shrink-0">
        
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-slate-700/40">
                <Clean24Logo className="h-10 sm:h-12 cursor-pointer shrink-0" lightMode={false} />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mobile close button */}
                {onCloseMobile && (
                  <button 
                    onClick={onCloseMobile}
                    className="lg:hidden p-2 bg-[#2D1B13] hover:bg-[#3D251A] rounded-xl text-slate-300 cursor-pointer transition-colors shrink-0"
                    aria-label="Close Navigation"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Active Branch Select Form */}
            <div className="mt-3 bg-[#1E293B] p-2.5 rounded-2xl border border-slate-700/60 shadow-inner">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[9px] text-slate-300/70 uppercase tracking-widest block font-extrabold flex items-center gap-1">
                  <Building2 size={11} className="text-blue-500" />
                  {t.activeBranch}
                </label>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </div>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700/60 text-xs text-slate-100 rounded-xl p-2 focus:outline-none focus:border-amber-500 font-sans cursor-pointer transition-colors font-bold"
              >
                {(currentRole === 'Owner' || currentRole === 'Admin') && (!currentUser?.assignedBranchIds || currentUser.assignedBranchIds.length === 0) && (
                  <option value="all">🏢 {t.allBranches}</option>
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
          /* COLLAPSED HEADER: Centered Brand Logo / Toggle Button */
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => setIsCollapsed && setIsCollapsed(!isCollapsed)}
              className="w-12 h-12 bg-white hover:bg-slate-100 p-1 rounded-2xl shadow-md border border-slate-700/60 flex items-center justify-center cursor-pointer transition-all active:scale-95 group"
              title="Expand Sidebar"
            >
              <img src="/logo.png" alt="TC Staff" className="w-9 h-9 object-contain group-hover:scale-105 transition-transform" />
            </button>
          </div>
        )}

      </div>

      {/* 2. SEARCH MENU FILTER BAR (When expanded) */}
      {!isCollapsed && (
        <div className="px-3.5 py-2.5 bg-[#0B1120] border-b border-slate-800 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-300/50" />
            <input
              type="text"
              placeholder={lang === 'en' ? "Search staff modules..." : "ស្វែងរកមុខងារបុគ្គលិក..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#1E293B] border border-slate-800 text-xs text-slate-100 placeholder-amber-200/40 rounded-xl pl-8.5 pr-3 py-1.5 focus:outline-none focus:border-amber-500 font-sans transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-slate-300/60 hover:text-slate-100 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. DYNAMIC NAVIGATION TABS LIST */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-8 space-y-3 custom-scrollbar bg-[#18110D]">
        
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
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group ${
                    active 
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/30' 
                      : 'text-slate-300/60 hover:bg-[#1E293B] hover:text-slate-300'
                  }`}
                  title={item.label}
                >
                  <item.icon size={19} className="stroke-[2.2]" />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-14 bg-[#2A170F] text-slate-100 border border-amber-500/20 text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
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
              <div className="space-y-1 border-b border-slate-800 pb-3">
                <button
                  onClick={() => toggleGroup('clean24_favorites_group')}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-black text-amber-400 uppercase tracking-widest hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
                    <span>{lang === 'en' ? 'Favorites' : 'សំណព្វចិត្ត'}</span>
                    <span className="text-[8px] text-slate-300/60 font-medium lowercase tracking-normal">
                      ({favoriteItems.length})
                    </span>
                  </div>
                  {favoritesExpanded ? <ChevronDown size={10} className="text-amber-400" /> : <ChevronRight size={10} className="text-amber-400" />}
                </button>

                {favoritesExpanded && (
                  <div className="space-y-1 pl-1 fade-in-slide">
                    {favoriteItems.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={`fav-${item.id}`}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            if (onCloseMobile) onCloseMobile();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                            ${active 
                              ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white font-bold shadow-md shadow-amber-950/40 border border-amber-500/30' 
                              : 'text-slate-100/75 hover:bg-[#1E293B] hover:text-slate-100'
                            }
                          `}
                          id={`fav_tab_${item.id}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <item.icon size={17} className={active ? 'text-slate-300' : 'text-blue-500/70 shrink-0'} />
                            <span className="truncate text-xs font-bold flex-1 text-left">{item.label}</span>
                          </div>
                          <span 
                            onClick={(e) => toggleFavorite(item.id, e)}
                            className="p-1 rounded-md hover:bg-amber-950/50 cursor-pointer transition-colors shrink-0"
                          >
                            <Star 
                              size={15} 
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
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-black text-slate-300/50 uppercase tracking-widest hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <group.icon size={12} className="text-blue-500 shrink-0" />
                      <span>{group.title}</span>
                      <span className="text-[8px] text-slate-300/40 font-medium lowercase tracking-normal">
                        ({group.visibleItems.length})
                      </span>
                    </div>
                    {expanded ? <ChevronDown size={11} className="text-slate-300/50" /> : <ChevronRight size={11} className="text-slate-300/50" />}
                  </button>

                  {/* Group Items */}
                  {expanded && (
                    <div className="space-y-1 pl-1 fade-in-slide">
                      {group.visibleItems.map((item) => {
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              if (onCloseMobile) onCloseMobile();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                              ${active 
                                ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white font-black shadow-md shadow-amber-950/40 border border-amber-500/30' 
                                : 'text-slate-100/75 hover:bg-[#1E293B] hover:text-slate-100'
                              }
                            `}
                            id={`nav_tab_${item.id}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.icon size={17} className={active ? 'text-slate-300 stroke-[2.5]' : 'text-blue-500/70 shrink-0'} />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <span 
                              onClick={(e) => toggleFavorite(item.id, e)}
                              className="p-1 rounded-md hover:bg-amber-950/50 cursor-pointer transition-colors shrink-0"
                            >
                              <Star 
                                size={15} 
                                className={favorites.includes(item.id) 
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-slate-300/20 opacity-0 group-hover/item:opacity-100 transition-opacity'
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
