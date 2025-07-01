'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { getAllDeckTemplateIds, getDeckTemplate } from '@/data/deck-templates';

interface DeckTemplateSelectorProps {
  onSelectTemplate: (templateId: string) => void;
  className?: string;
}

export function DeckTemplateSelector({ onSelectTemplate, className }: DeckTemplateSelectorProps) {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    // Load available templates
    const templateIds = getAllDeckTemplateIds();
    const loadedTemplates = templateIds.map(id => {
      const template = getDeckTemplate(id);
      return {
        id,
        name: template?.name || id,
        description: template?.description || '',
      };
    });
    setTemplates(loadedTemplates);
  }, []);

  const handleSelectTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
    }
  };

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Start with a Template Deck</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="template-select" className="block text-sm font-medium mb-2">
            Choose a pre-built deck:
          </label>
          <select
            id="template-select"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        
        {selectedTemplate && (
          <div className="p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              {templates.find(t => t.id === selectedTemplate)?.description}
            </p>
          </div>
        )}
        
        <Button
          onClick={handleSelectTemplate}
          disabled={!selectedTemplate}
          className="w-full"
        >
          Use This Template
        </Button>
      </div>
    </div>
  );
}