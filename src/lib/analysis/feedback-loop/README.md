# Analyzer Feedback Loop System

An automated continuous improvement system for the Pokemon TCG deck analyzer that uses OpenAI to review analysis quality and suggest code improvements.

## Overview

The feedback loop system:
1. Runs the deck analyzer on a library of test decks
2. Sends the results to OpenAI Assistant for expert review
3. Receives code improvements and suggestions
4. Validates and optionally applies the improvements
5. Re-tests to measure improvement
6. Tracks all changes with rollback capability

## Quick Start

### 1. Set up environment variables

```bash
# Add to .env.local
OPENAI_API_KEY=your-api-key
FEEDBACK_LOOP_SECRET=your-secret-key
```

### 2. Run a test cycle

```bash
# Dry run (no changes)
npm run analyzer:feedback -- --dry-run

# Apply improvements with balanced settings
npm run analyzer:feedback -- --auto-apply --preset=balanced

# Test specific categories
npm run analyzer:feedback -- --categories=energy-problems,consistency-issues

# Show help
npm run analyzer:feedback -- --help
```

### 3. Check results via API

```bash
# Get status
curl -H "Authorization: Bearer YOUR_SECRET" \
  http://localhost:3000/api/analysis/feedback-loop?action=status

# Get history
curl -H "Authorization: Bearer YOUR_SECRET" \
  http://localhost:3000/api/analysis/feedback-loop?action=history&limit=10
```

## Configuration

### Presets

- **conservative**: Only high-confidence bug fixes (95% threshold)
- **balanced**: Most improvements with safety checks (85% threshold)
- **aggressive**: All improvements with higher risk (70% threshold)
- **testing**: Minimal run for testing (5 decks, low cost)

### Custom Configuration

Create a JSON file with your settings:

```json
{
  "autoApplyThreshold": 90,
  "maxImprovementsPerRun": 5,
  "testSettings": {
    "sampleSize": 10,
    "categories": ["energy-problems", "consistency-issues"]
  },
  "safety": {
    "rollbackThreshold": 3
  }
}
```

Use it:
```bash
npm run analyzer:feedback -- --config=./my-config.json
```

## Test Deck Categories

- **well-built**: Meta decks and tournament winners
- **fundamentally-broken**: Missing basics, illegal configurations
- **consistency-issues**: Poor draw/search engines
- **energy-problems**: Wrong energy counts or types
- **evolution-heavy**: Complex evolution lines
- **ability-dependent**: Relies on Pokemon abilities
- **prize-trade-poor**: Too many multi-prize Pokemon
- **budget-friendly**: Good budget deck examples
- **edge-case**: Special rules (ACE SPEC, Prism Star)
- **beginner-mistake**: Common new player errors

## Architecture

### Core Components

1. **AnalyzerImprovementSystem**: Main orchestrator
2. **TestDeckLibrary**: Collection of test decks with expected results
3. **ImprovementParser**: Validates and parses code suggestions
4. **ImprovementApplier**: Safely applies changes with backup
5. **ImprovementTracker**: Tracks history and metrics

### Safety Features

- AST validation of all code changes
- Automatic backup before changes
- Test execution after changes
- Automatic rollback on test failure
- File pattern restrictions
- Code complexity limits

## API Endpoints

### POST /api/analysis/feedback-loop

Run an improvement cycle.

**Headers:**
- `Authorization: Bearer YOUR_SECRET`

**Body:**
```json
{
  "dryRun": false,
  "preset": "balanced",
  "options": {
    "categories": ["energy-problems"],
    "maxImprovements": 5
  }
}
```

### GET /api/analysis/feedback-loop

Get status, history, or configuration.

**Query Parameters:**
- `action`: "status" | "history" | "config"
- `limit`: Number of history items (for history action)

## Metrics and Monitoring

The system tracks:
- Accuracy improvements per run
- Success/failure rates
- OpenAI API usage and costs
- Applied improvements by category
- Rollback frequency

Access metrics:
```typescript
const system = new AnalyzerImprovementSystem(config);
const stats = await system.getStatistics();
```

## Cost Controls

Default limits:
- $1.00 per run maximum
- $30.00 per month maximum
- Automatic pause when budget exceeded

Costs are estimated based on:
- GPT-4.1-mini: ~$0.0075 per 1K tokens
- Average run: ~$0.10-0.50

## Development

### Adding Test Decks

1. Add to `src/lib/analysis/test-decks/deck-data.ts`
2. Define expected issues and score range
3. Include in appropriate category

### Extending Improvements

1. Add new improvement categories in `config.ts`
2. Update parser for new code patterns
3. Add safety checks in applier

### Custom Review Prompts

Update the OpenAI Assistant with specific evaluation criteria:
- Tier 1: Fundamental playability checks
- Tier 2: Consistency engine metrics
- Tier 3: Competitive analysis
- Tier 4: Meta optimization

## Troubleshooting

### Common Issues

1. **"Validation failed"**: Code syntax error in suggestion
   - Check parser output for details
   - May need to update AST validation

2. **"Tests failed, rolled back"**: Applied changes broke tests
   - Review the specific test failures
   - Adjust safety thresholds

3. **"Budget exceeded"**: Monthly cost limit reached
   - Check `costControls` in configuration
   - Review token usage patterns

### Debug Mode

Run with verbose output:
```bash
npm run analyzer:feedback -- --verbose --dry-run
```

## Best Practices

1. Always run dry-run first on new configurations
2. Start with conservative preset, gradually increase
3. Review pending improvements before auto-applying
4. Monitor accuracy trends over time
5. Keep backups of successful improvements
6. Test on diverse deck categories

## Future Enhancements

- [ ] Web dashboard for monitoring
- [ ] Automated scheduling via cron
- [ ] Multi-model support (GPT-4, Claude)
- [ ] Collaborative review workflow
- [ ] Performance regression detection
- [ ] Test generation from improvements