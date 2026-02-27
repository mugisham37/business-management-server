#!/bin/bash

# Script to generate TypeScript definitions from proto files
# This uses @grpc/proto-loader for dynamic loading at runtime
# No code generation needed - proto files are loaded dynamically

echo "Proto files are loaded dynamically using @grpc/proto-loader"
echo "No code generation required for NestJS gRPC implementation"
echo "Proto files location: server/proto/"
echo ""
echo "Available proto files:"
find proto -name "*.proto" -type f

exit 0
