/**
 * Message Transform Predicate Pipeline
 * 
 * Wave 2: Predicate-based message filtering
 * 
 * Features:
 * - Predicate-based skipping (don't transform irrelevant messages)
 * - Priority-based execution order
 * - Required vs optional transforms
 */

import { log } from "../../shared/logger"
import { perfMonitor, BaselineMetrics } from "../../shared/performance-monitor"

export interface Message {
  id?: string
  role?: string
  content?: string
  parts?: Array<{ type: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface Transform {
  name: string
  predicate: (msg: Message) => boolean  // Skip if false
  transform: (msg: Message) => Message | null  // null = remove message
  priority: number  // Lower = earlier
  required: boolean  // If true, predicate failure is fatal
}

export interface TransformPipelineOptions {
  measurePerformance?: boolean
  logSkipped?: boolean
}

export class MessageTransformPipeline {
  private transforms: Transform[] = []
  
  addTransform(t: Transform): void {
    this.transforms.push(t)
    // Keep sorted by priority
    this.transforms.sort((a, b) => a.priority - b.priority)
  }
  
  /**
   * Process messages through transform pipeline
   */
  process(messages: Message[], options: TransformPipelineOptions = {}): Message[] {
    const { measurePerformance = true, logSkipped = false } = options
    const results: Message[] = []
    
    for (const msg of messages) {
      let current = msg
      let shouldInclude = true
      
      for (const transform of this.transforms) {
        // Check predicate first
        let predicateMatch: boolean
        
        if (measurePerformance) {
          predicateMatch = perfMonitor.measure(
            `${BaselineMetrics.MESSAGE_TRANSFORM}.${transform.name}.predicate`,
            () => transform.predicate(current)
          )
        } else {
          predicateMatch = transform.predicate(current)
        }
        
        if (!predicateMatch) {
          if (transform.required) {
            // Required transform rejected - skip this message
            if (logSkipped) {
              log(`[TransformPipeline] ${transform.name} rejected message (required)`)
            }
            shouldInclude = false
            break
          }
          
          // Optional transform skipped
          if (logSkipped) {
            log(`[TransformPipeline] ${transform.name} skipped (predicate false)`)
          }
          continue
        }
        
        // Apply transform
        let result: Message | null
        
        if (measurePerformance) {
          result = perfMonitor.measure(
            `${BaselineMetrics.MESSAGE_TRANSFORM}.${transform.name}.transform`,
            () => transform.transform(current)
          )
        } else {
          result = transform.transform(current)
        }
        
        if (result === null) {
          // Transform signaled to remove message
          shouldInclude = false
          break
        }
        
        current = result
      }
      
      if (shouldInclude) {
        results.push(current)
      }
    }
    
    // Record transform count
    perfMonitor.measure(BaselineMetrics.MESSAGE_TRANSFORM_COUNT, () => {})
    
    return results
  }
  
  /**
   * Get transforms for a specific message (for debugging)
   */
  getApplicableTransforms(msg: Message): Transform[] {
    return this.transforms.filter(t => t.predicate(msg))
  }
  
  /**
   * Clear all transforms
   */
  clear(): void {
    this.transforms = []
  }
  
  /**
   * Get transform count
   */
  getTransformCount(): number {
    return this.transforms.length
  }
}

// Common predicates for reuse
export const MessagePredicates = {
  /** Message has text content */
  hasText: (msg: Message) => typeof msg.content === 'string' && msg.content.length > 0,
  
  /** Message is from user */
  isUser: (msg: Message) => msg.role === 'user',
  
  /** Message is from assistant */
  isAssistant: (msg: Message) => msg.role === 'assistant',
  
  /** Message is a tool message */
  isTool: (msg: Message) => msg.role === 'tool',
  
  /** Message has thinking blocks */
  hasThinking: (msg: Message) => msg.parts?.some(p => p.type === 'thinking') ?? false,
  
  /** Message has tool invocations */
  hasTools: (msg: Message) => msg.parts?.some(p => p.type === 'tool') ?? false,
  
  /** Message is not empty */
  notEmpty: (msg: Message) => {
    if (msg.content && typeof msg.content === 'string') return msg.content.length > 0
    if (msg.parts && Array.isArray(msg.parts)) return msg.parts.length > 0
    return false
  }
}

// Example transforms
export const ExampleTransforms = {
  /** Validate thinking block structure */
  thinkingBlockValidator: {
    name: 'thinkingBlockValidator',
    predicate: MessagePredicates.hasThinking,
    transform: (msg: Message) => {
      // Validation logic here
      // Return message if valid, null if should be removed
      return msg
    },
    priority: 0,
    required: true
  },
  
  /** Detect keywords in user messages */
  keywordDetector: {
    name: 'keywordDetector',
    predicate: (msg: Message) => MessagePredicates.isUser(msg) && MessagePredicates.hasText(msg),
    transform: (msg: Message) => {
      // Keyword detection logic
      return msg
    },
    priority: 10,
    required: false
  },
  
  /** Inject context for agent */
  contextInjector: {
    name: 'contextInjector',
    predicate: MessagePredicates.isAssistant,
    transform: (msg: Message) => {
      // Context injection logic
      return msg
    },
    priority: 20,
    required: false
  }
}
