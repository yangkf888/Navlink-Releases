import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NavLink API',
            version: '2.0.0',
            description: 'API documentation for NavLink application',
        },
        servers: [
            {
                url: 'http://localhost:3000/api',
                description: 'Development server',
            },
            {
                url: 'http://localhost:3005/api',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./server/routes/*.js', './server.js'], // Files containing annotations
};

export const swaggerSpec = swaggerJsdoc(options);
