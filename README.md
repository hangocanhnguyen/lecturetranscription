# Lectureleaf
Ứng dụng web tĩnh ghi âm bài giảng bằng micro hoặc đọc audio từ file video/audio, chép lại lời nói bằng Whisper Tiny (mặc định) hoặc Base đa ngôn ngữ và tải bản chép lời dưới dạng Word (.docx). Khi ghi âm, Whisper Tiny hiển thị phụ đề tiếng Anh ngay trong tab và cập nhật cụm từ khi có thêm âm thanh. Sau khi dừng, người dùng có thể lưu bản ghi, tải phụ đề thành file Word hoặc chép lại toàn bộ bản ghi. Phụ đề đầu tiên cần đợi mô hình tải xong. Độ trễ phụ thuộc thiết bị.

## Dùng trên máy
Từ bản clone, chạy `sh scripts/prepare-decoder.sh` để tải bộ giải mã FFmpeg. Chạy `python3 -m http.server 8000 --directory dist` từ thư mục dự án. Mở http://localhost:8000. Micro cần localhost hoặc HTTPS. Thử Chrome/Edge desktop. Khi chọn video, ứng dụng tách rãnh tiếng đầu tiên có tín hiệu và giải mã được ngay trên thiết bị bằng FFmpeg (WebAssembly). File âm thanh dùng bộ giải mã trình duyệt và thử FFmpeg nếu cần. File cần có rãnh tiếng giải mã được và đủ bộ nhớ trên thiết bị.

## GitHub Pages
Giải nén rồi đẩy toàn bộ nội dung vào nhánh main của repo GitHub. Trong Settings → Pages → Build and deployment, chọn GitHub Actions. Chạy workflow “Publish Lectureleaf” trong tab Actions hoặc push thay đổi lên main. Workflow xuất bản thư mục dist. Mọi đường dẫn asset đều tương đối. Có thể dùng bất kỳ static host HTTPS nào.

## Xử lý và dữ liệu
Không cần tài khoản hoặc API key. Trình duyệt tải Transformers.js 2.17.2 và WebAssembly từ jsDelivr, mô hình Xenova/whisper-tiny.en cho phụ đề và chế độ Nhanh, hoặc Xenova/whisper-base ở chế độ Kỹ hơn từ Hugging Face. Âm thanh và văn bản ở trên máy. Cache mô hình tùy trình duyệt. Nội dung bài giảng nằm trong bộ nhớ của tab, tải bản ghi và tài liệu Word để lưu. Ghi âm dùng micro, bao gồm khi người dùng nghe giảng qua loa ngoài.
 
Nhận diện mặc định bằng tiếng Anh. Worker nhận audio mono 16 kHz, chép file theo từng đoạn tối đa 30 giây và ưu tiên ngắt ở chỗ âm lượng thấp. Nếu một cụm từ lặp bất thường, ứng dụng nghe lại đoạn đó theo từng phần ngắn hơn. Những chuỗi vẫn lặp với tốc độ khó phù hợp với lời nói được đánh dấu [không nghe rõ]. Bản chép lời hiển thị theo thứ tự nói. Tên riêng, thuật ngữ và đoạn nhiễu cần đối chiếu khi dùng để học. Bài dài có thể cần nhiều RAM do giải mã toàn bộ audio đầu vào. Có thể chia file thành các phần ngắn hơn.

## Tốc độ
Chế độ Nhanh dùng mô hình Tiny lượng tử hóa, đổi lại độ chính xác có thể giảm. Mô hình được giữ trong worker sau khi hoàn tất để tái sử dụng cho file tiếp theo. Hủy xử lý giải phóng worker ngay. Đổi chế độ có thể cần tải mô hình khác. Thời gian chuẩn bị mô hình và xử lý audio được hiển thị riêng. Tốc độ thực tế phụ thuộc thiết bị và âm thanh.
