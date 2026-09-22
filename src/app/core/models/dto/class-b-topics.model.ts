export interface ClassBTopic {
  id: string;
  class_number: number;
  topic: string;
  created_at: string;
  updated_at: string;
}

export type ClassBTopicInsert = Omit<ClassBTopic, 'id' | 'created_at' | 'updated_at'>;
export type ClassBTopicUpdate = Partial<ClassBTopicInsert>;
