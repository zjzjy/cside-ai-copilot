import { useEffect, useState } from 'react';
import { Table, Modal, Form, Input, Select, Button, message, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getBrands, updateBrand } from '../api/brand';
import type { BrandResponse } from '../api/types';

interface BrandRow {
  key: number;
  id: number;
  name: string;
  tone: string;
  style: string;
  forbiddenWords: string[];
  returnPolicy: string;
  warranty: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

function extractRow(brand: BrandResponse): BrandRow {
  const config = brand.config || {};
  return {
    key: brand.id,
    id: brand.id,
    name: brand.name,
    tone: (config.tone as string) || '',
    style: (config.style as string) || '',
    forbiddenWords: (config.forbidden_words as string[]) || [],
    returnPolicy: (config.return_policy as string) || '',
    warranty: (config.warranty as Record<string, string>) || {},
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

export default function BrandConfigPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const res = await getBrands();
      setBrands(res.data.data.map(extractRow));
    } catch {
      message.error('加载品牌列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (brand: BrandRow) => {
    setEditingBrand(brand);
    form.setFieldsValue({
      tone: brand.tone,
      style: brand.style,
      forbiddenWords: brand.forbiddenWords,
      returnPolicy: brand.returnPolicy,
      warranty: Object.entries(brand.warranty).map(([key, value]) => ({ key, value })),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingBrand) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const warranty: Record<string, string> = {};
      (values.warranty || []).forEach(({ key, value }: { key: string; value: string }) => {
        if (key) warranty[key] = value || '';
      });

      const config: Record<string, unknown> = {
        tone: values.tone,
        style: values.style,
        forbidden_words: values.forbiddenWords || [],
        return_policy: values.returnPolicy,
        warranty,
      };

      await updateBrand(editingBrand.id, { config });
      message.success('品牌配置已保存');
      setModalOpen(false);
      loadBrands();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<BrandRow> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '品牌名', dataIndex: 'name', width: 100 },
    {
      title: '话术风格', dataIndex: 'tone', width: 200, ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '禁用语', dataIndex: 'forbiddenWords', width: 300,
      render: (words: string[]) => (
        <Space wrap>
          {(words || []).slice(0, 3).map((w) => <Tag key={w} color="red">{w}</Tag>)}
          {words && words.length > 3 && <Tag>+{words.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '退货政策', dataIndex: 'returnPolicy', width: 200, ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '更新时间', dataIndex: 'updatedAt', width: 180,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_, record) => <Button type="link" onClick={() => openEdit(record)}>编辑</Button>,
    },
  ];

  return (
    <div>
      <h2>品牌配置</h2>
      <Table columns={columns} dataSource={brands} loading={loading} scroll={{ x: 1100 }} />

      <Modal
        title={`编辑品牌配置 — ${editingBrand?.name || ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="tone" label="话术基调" rules={[{ required: true, message: '请输入话术基调' }]}>
            <Input placeholder="如：专业科技感，亲切但不轻浮" />
          </Form.Item>
          <Form.Item name="style" label="话术风格说明" rules={[{ required: true, message: '请输入话术风格说明' }]}>
            <Input.TextArea rows={3} placeholder="描述该品牌话术的语言风格和表达方式" />
          </Form.Item>
          <Form.Item name="forbiddenWords" label="品牌禁用语">
            <Select mode="tags" placeholder="输入后按回车添加" />
          </Form.Item>
          <Form.Item name="returnPolicy" label="退货政策" rules={[{ required: true, message: '请输入退货政策' }]}>
            <Input.TextArea rows={2} placeholder="如：支持7天无理由退货（激活后不支持除外）" />
          </Form.Item>
          <Form.Item label="保修条款">
            <Form.List name="warranty">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[name, 'key']} rules={[{ required: true, message: '请输入品类' }]} noStyle>
                        <Input placeholder="品类 (phone/accessory/extended)" style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item name={[name, 'value']} rules={[{ required: true, message: '请输入保修描述' }]} noStyle>
                        <Input placeholder="保修描述" style={{ width: 320 }} />
                      </Form.Item>
                      <Button onClick={() => remove(name)} danger>删除</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ key: '', value: '' })} block>
                    + 添加保修条款
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
