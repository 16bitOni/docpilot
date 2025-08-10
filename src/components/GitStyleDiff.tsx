import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface GitStyleDiffProps {
  originalContent: string;
  newContent: string;
}

const GitStyleDiff: React.FC<GitStyleDiffProps> = ({ originalContent, newContent }) => {
  const generateDiff = (original: string, modified: string): DiffLine[] => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diff: DiffLine[] = [];
    
    let oldLineNum = 1;
    let newLineNum = 1;
    
    // Simple line-by-line diff algorithm
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const modifiedLine = modifiedLines[i];
      
      if (originalLine === modifiedLine) {
        // Unchanged line
        if (originalLine !== undefined) {
          diff.push({
            type: 'unchanged',
            content: originalLine,
            oldLineNumber: oldLineNum,
            newLineNumber: newLineNum
          });
          oldLineNum++;
          newLineNum++;
        }
      } else {
        // Line changed - show both removed and added
        if (originalLine !== undefined) {
          diff.push({
            type: 'removed',
            content: originalLine,
            oldLineNumber: oldLineNum
          });
          oldLineNum++;
        }
        
        if (modifiedLine !== undefined) {
          diff.push({
            type: 'added',
            content: modifiedLine,
            newLineNumber: newLineNum
          });
          newLineNum++;
        }
      }
    }
    
    return diff;
  };

  const diffLines = generateDiff(originalContent, newContent);
  
  // Count changes
  const addedLines = diffLines.filter(line => line.type === 'added').length;
  const removedLines = diffLines.filter(line => line.type === 'removed').length;
  
  return (
    <div className="space-y-4">
      {/* Diff Stats */}
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-1 text-green-400">
          <Plus className="h-3 w-3" />
          <span>{addedLines} additions</span>
        </div>
        <div className="flex items-center space-x-1 text-red-400">
          <Minus className="h-3 w-3" />
          <span>{removedLines} deletions</span>
        </div>
      </div>
      
      {/* Diff Content */}
      <div className="border border-editor-border rounded-lg overflow-hidden">
        <div className="bg-editor-panel border-b border-editor-border px-4 py-2">
          <span className="text-sm font-medium">File Changes</span>
        </div>
        
        <div className="max-h-96 overflow-auto">
          {diffLines.map((line, index) => (
            <div
              key={index}
              className={`flex items-start text-xs font-mono ${
                line.type === 'added'
                  ? 'bg-green-500/10 text-green-300'
                  : line.type === 'removed'
                  ? 'bg-red-500/10 text-red-300'
                  : 'bg-editor-background text-muted-foreground'
              }`}
            >
              {/* Line Numbers */}
              <div className="flex-shrink-0 w-16 px-2 py-1 text-right border-r border-editor-border/50">
                <span className="text-muted-foreground/60">
                  {line.type === 'removed' ? line.oldLineNumber : 
                   line.type === 'added' ? line.newLineNumber :
                   line.oldLineNumber}
                </span>
              </div>
              
              {/* Change Indicator */}
              <div className="flex-shrink-0 w-6 px-1 py-1 text-center">
                {line.type === 'added' && <Plus className="h-3 w-3 text-green-400" />}
                {line.type === 'removed' && <Minus className="h-3 w-3 text-red-400" />}
                {line.type === 'unchanged' && <span className="text-muted-foreground/40"> </span>}
              </div>
              
              {/* Line Content */}
              <div className="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                {line.content || ' '}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GitStyleDiff;