export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "EC Backend API",
    version: "0.1.0",
    description:
      "ECドメイン（注文・在庫）のバックエンドAPI。デモ用決済モード切替エンドポイントを含む。",
  },
  servers: [{ url: "http://localhost:3000", description: "Local" }],
  tags: [
    { name: "Orders", description: "注文操作" },
    { name: "Demo", description: "デモ用コントロール（DEMO_CONTROLS_ENABLED=true 時のみ有効）" },
    { name: "System", description: "ヘルスチェック" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "ヘルスチェック",
        responses: {
          "200": { description: "サービス稼働中" },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "注文を受け付ける",
        description:
          "決済処理 → 注文保存 → OrderPlacedDomainEvent 発行。在庫確保は非同期（RabbitMQ 経由）。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PlaceOrderRequest" },
              examples: {
                normal: {
                  summary: "通常注文",
                  value: {
                    orderId: "550e8400-e29b-41d4-a716-446655440000",
                    customerId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                    items: [
                      {
                        productId: "11111111-1111-4111-8111-111111111111",
                        quantity: 2,
                        unitPrice: 1000,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "注文受付完了（在庫確保は非同期）",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlaceOrderResponse" },
              },
            },
          },
          "400": {
            description:
              "バリデーションエラー（UUID不正・決済タイムアウト等）",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  domain: {
                    summary: "UUID バリデーション失敗",
                    value: { type: "domain", msg: "Invalid UUID: customer-001" },
                  },
                  application: {
                    summary: "決済タイムアウト",
                    value: {
                      type: "application",
                      msg: "Payment failed: timeout",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "注文を取得する",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
        ],
        responses: {
          "200": {
            description: "注文情報",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          "404": {
            description: "注文が存在しない",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  type: "not_found",
                  msg: "Order not found: 550e8400-...",
                },
              },
            },
          },
        },
      },
    },
    "/demo/payment-mode": {
      post: {
        tags: ["Demo"],
        summary: "決済モードを切り替える",
        description:
          "SUCCESS: 常に成功 / TIMEOUT: 常にタイムアウト / RANDOM: ランダム。DEMO_CONTROLS_ENABLED=true の場合のみ有効。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaymentModeRequest" },
              examples: {
                success: { summary: "常に成功", value: { mode: "SUCCESS" } },
                timeout: {
                  summary: "常にタイムアウト",
                  value: { mode: "TIMEOUT" },
                },
                random: { summary: "ランダム", value: { mode: "RANDOM" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "モード変更完了",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentModeResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      PlaceOrderRequest: {
        type: "object",
        required: ["customerId", "items"],
        properties: {
          orderId: {
            type: "string",
            format: "uuid",
            description: "省略時はサーバー側で UUID v4 を生成",
          },
          customerId: { type: "string", format: "uuid" },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItem" },
          },
        },
      },
      OrderItem: {
        type: "object",
        required: ["productId", "quantity", "unitPrice"],
        properties: {
          productId: { type: "string", format: "uuid" },
          quantity: { type: "integer", minimum: 1 },
          unitPrice: { type: "number", minimum: 0 },
        },
      },
      PlaceOrderResponse: {
        type: "object",
        properties: {
          orderId: { type: "string", format: "uuid" },
        },
      },
      OrderResponse: {
        type: "object",
        properties: {
          orders: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                customerId: { type: "string", format: "uuid" },
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/OrderItem" },
                },
                totalAmount: { type: "number" },
                status: {
                  type: "string",
                  enum: ["PENDING", "FAILED"],
                  description: "PENDING: 処理中 / FAILED: 在庫不足等で補償済み",
                },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      PaymentModeRequest: {
        type: "object",
        required: ["mode"],
        properties: {
          mode: { type: "string", enum: ["SUCCESS", "TIMEOUT", "RANDOM"] },
        },
      },
      PaymentModeResponse: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["SUCCESS", "TIMEOUT", "RANDOM"] },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["domain", "application", "not_found", "infrastructure", "server"],
          },
          msg: { type: "string" },
        },
      },
    },
  },
};
