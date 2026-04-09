import React, { createContext, useContext, useState, useCallback } from 'react';
import { Business, Service, Employee, Appointment, ServiceCategory } from '@/types';
import { getBusinessData, businesses } from '@/data/mockData';

interface BusinessContextType {
  currentBusinessId: string;
  setCurrentBusinessId: (id: string) => void;
  business: Business;
  services: Service[];
  employees: Employee[];
  appointments: Appointment[];
  categories: ServiceCategory[];
  allBusinesses: Business[];
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  addService: (service: Service) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  updateSettings: (settings: Partial<Business['settings']>) => void;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [currentBusinessId, setCurrentBusinessId] = useState('biz-1');
  const [businessDataMap, setBusinessDataMap] = useState(() => {
    const map: Record<string, ReturnType<typeof getBusinessData>> = {};
    businesses.forEach(b => {
      map[b.id] = getBusinessData(b.id);
    });
    return map;
  });

  const data = businessDataMap[currentBusinessId];

  const addAppointment = useCallback((appointment: Appointment) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        appointments: [...prev[currentBusinessId].appointments, appointment],
      },
    }));
  }, [currentBusinessId]);

  const updateAppointment = useCallback((id: string, updates: Partial<Appointment>) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        appointments: prev[currentBusinessId].appointments.map(a => a.id === id ? { ...a, ...updates } : a),
      },
    }));
  }, [currentBusinessId]);

  const addService = useCallback((service: Service) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        services: [...prev[currentBusinessId].services, service],
      },
    }));
  }, [currentBusinessId]);

  const updateService = useCallback((id: string, updates: Partial<Service>) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        services: prev[currentBusinessId].services.map(s => s.id === id ? { ...s, ...updates } : s),
      },
    }));
  }, [currentBusinessId]);

  const deleteService = useCallback((id: string) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        services: prev[currentBusinessId].services.filter(s => s.id !== id),
      },
    }));
  }, [currentBusinessId]);

  const addEmployee = useCallback((employee: Employee) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        employees: [...prev[currentBusinessId].employees, employee],
      },
    }));
  }, [currentBusinessId]);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        employees: prev[currentBusinessId].employees.map(e => e.id === id ? { ...e, ...updates } : e),
      },
    }));
  }, [currentBusinessId]);

  const deleteEmployee = useCallback((id: string) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        employees: prev[currentBusinessId].employees.filter(e => e.id !== id),
      },
    }));
  }, [currentBusinessId]);

  const updateSettings = useCallback((settings: Partial<Business['settings']>) => {
    setBusinessDataMap(prev => ({
      ...prev,
      [currentBusinessId]: {
        ...prev[currentBusinessId],
        business: {
          ...prev[currentBusinessId].business,
          settings: { ...prev[currentBusinessId].business.settings, ...settings },
        },
      },
    }));
  }, [currentBusinessId]);

  return (
    <BusinessContext.Provider value={{
      currentBusinessId,
      setCurrentBusinessId,
      business: data.business,
      services: data.services,
      employees: data.employees,
      appointments: data.appointments,
      categories: data.categories,
      allBusinesses: businesses,
      addAppointment,
      updateAppointment,
      addService,
      updateService,
      deleteService,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      updateSettings,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
