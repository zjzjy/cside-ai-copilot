import { useEffect, useState } from 'react';
import { Table, Modal, Form, Input, Select, Button, message, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getStores, updateStore } from '../api/store';
import type { StoreResponse } from '../api/types';

interface StoreRow {
  key: number;
  id: number;
  name: string;
  brandId: number;
  brandName: string;
  platform: string;
  urlPattern: string;
  promotions: Promotion[];
  specialRules: Record<string, string>;
}

interface Promotion {
  name: string;
  period: string;
  rules: string[];
  special_notes: string;
}

function extractRow(store: StoreResponse): StoreRow {
  const config = store.config || {};
  return {
    key: store.id,
    id: store.id,
    name: store.name,
    brandId: store.brandId,
    brandName: store.brandName,
    platform: store.platform,
    urlPattern: store.urlPattern || '',
    promotions: (config.current_promotions as Promotion[]) || [],
    specialRules: (config.store_specific_rules as Record<string, string>) || {},
  };
}

const platformLabels: Record<string, string> = {
  taobao: '淘宝', tmall: '天猫', jd: '京东', pdd: '拼多多', douyin: '抖音',
};

export default function StoreConfigPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const res = await getStores();
      setStores(res.data.data.map(extractRow));
    } catch {
      message.error('加载店铺列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (store: StoreRow) => {
    setEditingStore(store);
    form.setFieldsValue({
      name: store.name,
      urlPattern: store.urlPattern,
      promotions: store.promotions.map((p) => ({
        name: p.name,
        period: p.period,
        rules: (p.rules || []).join('\n'),
        special_notes: p.special_notes,
      })),
      specialRules: Object.entries(store.specialRules).map(([key, value]) => ({ key, value })),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingStore) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const promotions = (values.promotions || []).map((p: { name: string; period: string; rules: string; special_notes: string }) => ({
        name: p.name || '',
        period: p.period || '',
        rules: (p.rules || '').split('\n').filter(Boolean),
        special_notes: p.special_notes || '',
      }));

      const specialRules: Record<string, string> = {};
      (values.specialRules || []).forEach(({ key, value }: { key: string; value: string }) => {
        if (key) specialRules[key] = value || '';
      });

      const config = {
        current_promotions: promotions,
        store_specific_rules: specialRules,
      };

      await updateStore(editingStore.id, {
        name: values.name,
        urlPattern: values.urlPattern,
        config,
      });
      message.success('店铺配置已保存');
      setModalOpen(false);
      loadStores();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<StoreRow> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '店铺名', dataIndex: 'name', width: 200, ellipsis: true },
    { title: '品牌', dataIndex: 'brandName', width: 80 },
    {
      title: '平台', dataIndex: 'platform', width: 80,
      render: (p: string) => <Tag>{platformLabels[p] || p}</Tag>,
    },
    {
      title: 'URL 匹配', dataIndex: 'urlPattern', width: 180, ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '促销活动', dataIndex: 'promotions', width: 200,
      render: (promos: Promotion[]) => (
        <Space wrap>
          {(promos || []).map((p, i) => (
            <Tag key={i} color="blue">{p.name}</Tag>
          ))}
          {!promos?.length && '-'}
        </Space>
      ),
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_, record) => <Button type="link" onClick={() => openEdit(record)}>编辑</Button>,
    },
  ];

  return (
    <div>
      <h2>店铺配置</h2>
      <Table columns={columns} dataSource={stores} loading={loading} scroll={{ x: 900 }} />

      <Modal
        title={`编辑店铺配置 — ${editingStore?.name || ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
            <Input placeholder="如：vivo官方旗舰店-淘宝" />
          </Form.Item>
          <Form.Item name="urlPattern" label="URL 识别模式">
            <Input placeholder="如：%.taobao.com%" />
          </Form.Item>

          <Form.Item label="促销活动">
            <Form.List name="promotions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <div key={key} style={{ border: '1px solid #f0f0f0', padding: 12, marginBottom: 12, borderRadius: 6 }}>
                      <Space style={{ display: 'flex', marginBottom: 8 }}>
                        <Form.Item name={[name, 'name']} label="活动名" rules={[{ required: true }]} noStyle>
                          <Input placeholder="如：618年中大促" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name={[name, 'period']} label="有效期" noStyle>
                          <Input placeholder="如：2026-06-01 ~ 2026-06-18" style={{ width: 240 }} />
                        </Form.Item>
                        <Button onClick={() => remove(name)} danger size="small">删除</Button>
                      </Space>
                      <Form.Item name={[name, 'rules']} label="活动规则">
                        <Input.TextArea rows={3} placeholder="每行一条规则" />
                      </Form.Item>
                      <Form.Item name={[name, 'special_notes']} label="备注">
                        <Input placeholder="如：活动价不与其他优惠叠加" />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    + 添加促销活动
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item label="店铺特殊规则">
            <Form.List name="specialRules">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[name, 'key']} rules={[{ required: true, message: '请输入规则名' }]} noStyle>
                        <Input placeholder="规则名" style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item name={[name, 'value']} rules={[{ required: true, message: '请输入规则内容' }]} noStyle>
                        <Input placeholder="规则内容" style={{ width: 380 }} />
                      </Form.Item>
                      <Button onClick={() => remove(name)} danger>删除</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ key: '', value: '' })} block>
                    + 添加特殊规则
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
