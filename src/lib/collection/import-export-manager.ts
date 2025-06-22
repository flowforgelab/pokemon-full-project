import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import Papa from 'papaparse';
import type {
  CollectionImportData,
  ImportResult,
  ImportError,
  ImportOptions,
  FieldMapping,
  CollectionBackup,
  CollectionCard,
  CardCondition,
  AcquisitionSource,
  StorageLocation,
} from './types';
import { QuickAddManager } from './quick-add-manager';

// CSV row schema
const csvRowSchema = z.object({
  cardName: z.string().min(1),
  setCode: z.string().optional(),
  quantity: z.string().transform(v => parseInt(v) || 1),
  condition: z.string().optional(),
  purchasePrice: z.string().optional().transform(v => parseFloat(v) || 0),
  acquiredDate: z.string().optional(),
  location: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

export class ImportExportManager {
  private quickAddManager: QuickAddManager;

  constructor() {
    this.quickAddManager = new QuickAddManager();
  }

  /**
   * Import collection from various formats
   */
  async importCollection(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    switch (data.format) {
      case 'csv':
        return await this.importFromCSV(userId, data);
      case 'json':
        return await this.importFromJSON(userId, data);
      case 'tcgdb':
        return await this.importFromTCGDB(userId, data);
      case 'deckbox':
        return await this.importFromDeckbox(userId, data);
      default:
        throw new Error(`Unsupported import format: ${data.format}`);
    }
  }

  /**
   * Import from CSV format
   */
  private async importFromCSV(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    const csvContent = typeof data.data === 'string' 
      ? data.data 
      : await this.readFile(data.data as File);

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => this.normalizeHeader(header),
    });

    if (parseResult.errors.length > 0) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: parseResult.errors.map((error, index) => ({
          row: error.row || index,
          field: 'parse',
          value: error.message,
          error: error.message,
        })),
      };
    }

    return await this.processImportData(
      userId,
      parseResult.data,
      data.options,
      data.mappings
    );
  }

  /**
   * Import from JSON format
   */
  private async importFromJSON(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    const jsonContent = typeof data.data === 'string'
      ? data.data
      : await this.readFile(data.data as File);

    let parsedData;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (error) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{
          row: 0,
          field: 'parse',
          value: jsonContent.slice(0, 100),
          error: 'Invalid JSON format',
        }],
      };
    }

    // Handle different JSON structures
    const items = Array.isArray(parsedData) ? parsedData : parsedData.collection || [];

    return await this.processImportData(
      userId,
      items,
      data.options,
      data.mappings
    );
  }

  /**
   * Import from TCGDB format
   */
  private async importFromTCGDB(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    // TCGDB specific format handling
    // This would need actual TCGDB format specifications
    const content = typeof data.data === 'string'
      ? data.data
      : await this.readFile(data.data as File);

    // Parse TCGDB format (simplified example)
    const lines = content.split('\n');
    const items = [];

    for (const line of lines) {
      if (line.trim()) {
        // Example: "2x Charizard ex [PAL]"
        const match = line.match(/^(\d+)x\s+(.+?)\s*\[([A-Z]+)\]$/);
        if (match) {
          items.push({
            quantity: match[1],
            cardName: match[2],
            setCode: match[3],
          });
        }
      }
    }

    return await this.processImportData(userId, items, data.options);
  }

  /**
   * Import from Deckbox format
   */
  private async importFromDeckbox(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    // Deckbox CSV has specific columns
    const csvContent = typeof data.data === 'string'
      ? data.data
      : await this.readFile(data.data as File);

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    // Map Deckbox columns to our format
    const mappings: FieldMapping[] = [
      { sourceField: 'Name', targetField: 'cardName' },
      { sourceField: 'Edition', targetField: 'setName' },
      { sourceField: 'Count', targetField: 'quantity', transform: v => parseInt(v) || 1 },
      { sourceField: 'Condition', targetField: 'condition', transform: this.mapDeckboxCondition },
      { sourceField: 'Price', targetField: 'purchasePrice', transform: v => parseFloat(v) || 0 },
    ];

    return await this.processImportData(
      userId,
      parseResult.data,
      data.options,
      mappings
    );
  }

  /**
   * Process import data with field mappings
   */
  private async processImportData(
    userId: string,
    rows: any[],
    options: ImportOptions,
    mappings?: FieldMapping[]
  ): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const imported: CollectionCard[] = [];
    let updated = 0;
    let skipped = 0;

    // Preview mode
    if (options.dryRun) {
      const preview = [];
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        try {
          const mapped = this.applyMappings(rows[i], mappings);
          const validated = await this.validateRow(mapped, i);
          preview.push(validated);
        } catch (error) {
          errors.push({
            row: i,
            field: 'validation',
            value: rows[i],
            error: error instanceof Error ? error.message : 'Validation failed',
          });
        }
      }

      return {
        success: true,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors,
        preview: preview as any,
      };
    }

    // Actual import
    for (let i = 0; i < rows.length; i++) {
      try {
        const mapped = this.applyMappings(rows[i], mappings);
        const validated = await this.validateRow(mapped, i);

        // Check if card exists
        const card = await this.findCard(validated.cardName, validated.setCode);
        if (!card) {
          throw new Error(`Card not found: ${validated.cardName}`);
        }

        // Check if user already owns this card
        const existing = await prisma.userCollection.findFirst({
          where: {
            userId,
            cardId: card.id,
            condition: validated.condition as CardCondition,
            location: validated.location as StorageLocation,
          },
        });

        if (existing) {
          if (options.updateExisting) {
            await prisma.userCollection.update({
              where: { id: existing.id },
              data: {
                quantity: existing.quantity + validated.quantity,
                purchasePrice: validated.purchasePrice || existing.purchasePrice,
                tags: validated.tags ? [...existing.tags, ...validated.tags] : existing.tags,
                notes: validated.notes || existing.notes,
                updatedAt: new Date(),
              },
            });
            updated++;
          } else if (options.skipDuplicates) {
            skipped++;
          }
        } else {
          const created = await prisma.userCollection.create({
            data: {
              userId,
              cardId: card.id,
              quantity: validated.quantity,
              condition: validated.condition as CardCondition,
              purchasePrice: validated.purchasePrice,
              source: AcquisitionSource.OTHER,
              location: validated.location as StorageLocation,
              tags: validated.tags || [],
              notes: validated.notes,
              forTrade: false,
              onWishlist: false,
              acquiredAt: validated.acquiredDate || new Date(),
            },
            include: { card: true },
          });
          imported.push(created as CollectionCard);
        }
      } catch (error) {
        errors.push({
          row: i,
          field: 'import',
          value: rows[i],
          error: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      imported: imported.length,
      updated,
      skipped,
      errors,
    };
  }

  /**
   * Export collection in various formats
   */
  async exportCollection(
    userId: string,
    format: 'csv' | 'json' | 'pdf',
    options?: {
      includeValues?: boolean;
      includeImages?: boolean;
      groupBy?: string;
    }
  ): Promise<{ content: string; filename: string }> {
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { card: { set: { releaseDate: 'desc' } } },
        { card: { collectorNumber: 'asc' } },
      ],
    });

    const date = new Date().toISOString().split('T')[0];
    
    switch (format) {
      case 'csv':
        return {
          content: this.exportToCSV(collection, options),
          filename: `pokemon-collection-${date}.csv`,
        };
      case 'json':
        return {
          content: this.exportToJSON(collection, options),
          filename: `pokemon-collection-${date}.json`,
        };
      case 'pdf':
        return {
          content: await this.exportToPDF(collection, options),
          filename: `pokemon-collection-${date}.pdf`,
        };
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Create collection backup
   */
  async createBackup(userId: string): Promise<CollectionBackup> {
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const data = JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      userId,
      collection: collection.map(item => ({
        cardId: item.cardId,
        cardName: item.card.name,
        setCode: item.card.set.code,
        quantity: item.quantity,
        condition: item.condition,
        purchasePrice: item.purchasePrice,
        acquiredAt: item.acquiredAt,
        location: item.location,
        tags: item.tags,
        notes: item.notes,
        forTrade: item.forTrade,
        onWishlist: item.onWishlist,
      })),
    });

    // Compress data
    const compressed = await this.compressData(data);

    const backup = await prisma.collectionBackup.create({
      data: {
        userId,
        cardCount: collection.length,
        totalValue: collection.reduce((sum, item) => 
          sum + (item.card.prices[0]?.marketPrice || 0) * item.quantity, 0
        ),
        format: 'json',
        compressed: true,
        size: compressed.length,
      },
    });

    // Store backup data (would typically use cloud storage)
    // For now, return with data URL
    const downloadUrl = `data:application/json;base64,${Buffer.from(compressed).toString('base64')}`;

    return {
      ...backup,
      downloadUrl,
    };
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    userId: string,
    backupId: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const backup = await prisma.collectionBackup.findFirst({
      where: { id: backupId, userId },
    });

    if (!backup) {
      throw new Error('Backup not found');
    }

    // In real implementation, fetch from cloud storage
    // For now, assume data is provided
    const data: CollectionImportData = {
      format: 'json',
      data: '{}', // Would be fetched from storage
      options,
    };

    return await this.importCollection(userId, data);
  }

  /**
   * Get import templates
   */
  getImportTemplates(): Array<{
    format: string;
    name: string;
    template: string;
    example: string;
    instructions: string;
  }> {
    return [
      {
        format: 'csv',
        name: 'Standard CSV',
        template: 'Card Name,Set Code,Quantity,Condition,Purchase Price,Location,Tags,Notes',
        example: 'Charizard ex,PAL,2,NEAR_MINT,250.00,BINDER,"favorite,competitive",My first pull',
        instructions: 'Use this format for general imports. Condition values: MINT, NEAR_MINT, LIGHTLY_PLAYED, MODERATELY_PLAYED, HEAVILY_PLAYED, DAMAGED',
      },
      {
        format: 'tcgplayer',
        name: 'TCGPlayer Collection',
        template: 'Product Name,Set Name,Number,Condition,Quantity,Price',
        example: 'Charizard ex,Paldea Evolved,199,Near Mint,2,250.00',
        instructions: 'Export your collection from TCGPlayer and import directly',
      },
      {
        format: 'ptcgo',
        name: 'PTCGO Export',
        template: '* <quantity> <card name> <set code> <collector number>',
        example: '* 2 Charizard ex PAL 199',
        instructions: 'Copy your PTCGO deck list format',
      },
    ];
  }

  /**
   * Validate import data
   */
  async validateImportData(
    data: CollectionImportData
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!data.data) {
        errors.push('No data provided');
      }

      if (!['csv', 'json', 'tcgdb', 'deckbox'].includes(data.format)) {
        errors.push(`Invalid format: ${data.format}`);
      }

      // Test parse a small sample
      if (data.format === 'csv' && typeof data.data === 'string') {
        const lines = data.data.split('\n').slice(0, 5);
        const sample = lines.join('\n');
        const result = Papa.parse(sample, { header: true });
        if (result.errors.length > 0) {
          errors.push('CSV parsing errors detected');
        }
      }

      if (data.format === 'json' && typeof data.data === 'string') {
        try {
          JSON.parse(data.data);
        } catch {
          errors.push('Invalid JSON format');
        }
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Validation failed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Private helper methods

  private normalizeHeader(header: string): string {
    const mappings: Record<string, string> = {
      'name': 'cardName',
      'card': 'cardName',
      'card name': 'cardName',
      'set': 'setCode',
      'edition': 'setCode',
      'set code': 'setCode',
      'qty': 'quantity',
      'count': 'quantity',
      'amount': 'quantity',
      'price': 'purchasePrice',
      'cost': 'purchasePrice',
      'acquired': 'acquiredDate',
      'date': 'acquiredDate',
    };

    const normalized = header.toLowerCase().trim();
    return mappings[normalized] || normalized.replace(/\s+/g, '');
  }

  private applyMappings(row: any, mappings?: FieldMapping[]): any {
    if (!mappings) return row;

    const mapped: any = {};
    
    mappings.forEach(mapping => {
      const value = row[mapping.sourceField];
      mapped[mapping.targetField] = mapping.transform 
        ? mapping.transform(value)
        : value;
    });

    // Copy unmapped fields
    Object.keys(row).forEach(key => {
      if (!mappings.some(m => m.sourceField === key)) {
        mapped[key] = row[key];
      }
    });

    return mapped;
  }

  private async validateRow(row: any, index: number): Promise<any> {
    try {
      const validated = csvRowSchema.parse(row);
      
      // Validate condition
      if (validated.condition) {
        const validConditions = ['MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 
          'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED'];
        if (!validConditions.includes(validated.condition.toUpperCase())) {
          validated.condition = 'NEAR_MINT'; // Default
        }
      } else {
        validated.condition = 'NEAR_MINT';
      }

      // Validate location
      if (validated.location) {
        const validLocations = ['BINDER', 'BOX', 'DECK', 'DISPLAY', 'SAFE', 'OTHER'];
        if (!validLocations.includes(validated.location.toUpperCase())) {
          validated.location = 'BINDER'; // Default
        }
      } else {
        validated.location = 'BINDER';
      }

      // Parse tags
      if (validated.tags) {
        validated.tags = validated.tags.split(',').map((t: string) => t.trim());
      }

      // Parse date
      if (validated.acquiredDate) {
        validated.acquiredDate = new Date(validated.acquiredDate);
        if (isNaN(validated.acquiredDate.getTime())) {
          validated.acquiredDate = null;
        }
      }

      return validated;
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Validation failed'}`);
    }
  }

  private async findCard(name: string, setCode?: string): Promise<any> {
    // First try exact match
    let card = await prisma.card.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(setCode ? { set: { code: { equals: setCode, mode: 'insensitive' } } } : {}),
      },
    });

    if (!card && setCode) {
      // Try without set code
      card = await prisma.card.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
        },
      });
    }

    if (!card) {
      // Try fuzzy match
      card = await prisma.card.findFirst({
        where: {
          name: { contains: name.split(' ')[0], mode: 'insensitive' },
        },
      });
    }

    return card;
  }

  private mapDeckboxCondition(condition: string): string {
    const mappings: Record<string, string> = {
      'mint': 'MINT',
      'm': 'MINT',
      'near mint': 'NEAR_MINT',
      'nm': 'NEAR_MINT',
      'excellent': 'LIGHTLY_PLAYED',
      'ex': 'LIGHTLY_PLAYED',
      'good': 'MODERATELY_PLAYED',
      'gd': 'MODERATELY_PLAYED',
      'played': 'HEAVILY_PLAYED',
      'pl': 'HEAVILY_PLAYED',
      'poor': 'DAMAGED',
      'pr': 'DAMAGED',
    };

    return mappings[condition.toLowerCase()] || 'NEAR_MINT';
  }

  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private exportToCSV(collection: any[], options?: any): string {
    const headers = ['Card Name', 'Set Name', 'Set Code', 'Quantity', 
      'Condition', 'Location', 'Tags', 'Notes'];
    
    if (options?.includeValues) {
      headers.push('Purchase Price', 'Current Value', 'Total Value');
    }

    const rows = collection.map(item => {
      const row = [
        item.card.name,
        item.card.set.name,
        item.card.set.code,
        item.quantity,
        item.condition,
        item.location,
        item.tags.join(', '),
        item.notes || '',
      ];

      if (options?.includeValues) {
        const currentPrice = item.card.prices[0]?.marketPrice || 0;
        row.push(
          item.purchasePrice.toFixed(2),
          currentPrice.toFixed(2),
          (currentPrice * item.quantity).toFixed(2)
        );
      }

      return row.map(cell => `"${cell}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private exportToJSON(collection: any[], options?: any): string {
    const data = {
      exportDate: new Date().toISOString(),
      totalCards: collection.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: options?.includeValues 
        ? collection.reduce((sum, item) => 
            sum + (item.card.prices[0]?.marketPrice || 0) * item.quantity, 0
          )
        : undefined,
      collection: collection.map(item => ({
        cardName: item.card.name,
        setName: item.card.set.name,
        setCode: item.card.set.code,
        quantity: item.quantity,
        condition: item.condition,
        location: item.location,
        tags: item.tags,
        notes: item.notes,
        acquiredAt: item.acquiredAt,
        ...(options?.includeValues ? {
          purchasePrice: item.purchasePrice,
          currentValue: item.card.prices[0]?.marketPrice || 0,
          totalValue: (item.card.prices[0]?.marketPrice || 0) * item.quantity,
        } : {}),
        ...(options?.includeImages ? {
          imageUrl: item.card.imageUrl,
        } : {}),
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  private async exportToPDF(collection: any[], options?: any): Promise<string> {
    // This would use a PDF generation library
    // For now, return a simple text format
    return `Pokemon TCG Collection Export
Generated: ${new Date().toLocaleDateString()}

Total Cards: ${collection.reduce((sum, item) => sum + item.quantity, 0)}
${options?.includeValues ? `Total Value: $${collection.reduce((sum, item) => 
  sum + (item.card.prices[0]?.marketPrice || 0) * item.quantity, 0).toFixed(2)}` : ''}

Collection:
${collection.map(item => 
  `- ${item.quantity}x ${item.card.name} (${item.card.set.code}) - ${item.condition}`
).join('\n')}`;
  }

  private async compressData(data: string): Promise<string> {
    // In a real implementation, use a compression library
    // For now, return the original data
    return data;
  }
}